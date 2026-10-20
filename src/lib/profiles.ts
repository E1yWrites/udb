// Browser profiles (SPEC: Profiles), v2: a named set of Mouse or Keyboard
// settings (DPI stages, polling rate, colour, brightness) that applies to any
// device of that category, kept in this browser and exportable as a file.
// Applying one writes each value through the panel's write procedure, so every
// value is read back (src/lib/profile-map.ts plans the writes). Nothing here
// touches a device or the network.
//
// Imported files and stored data are untrusted: size, shape and every field are
// checked, and unknown fields are dropped. v1 profiles (one device's own rows)
// are converted when a mapping exists and kept as they were otherwise, so
// nothing a user saved is lost.

export type Category = 'mouse' | 'keyboard';
export const POLLING_RATES = [125, 250, 500, 1000, 2000, 4000, 8000] as const;
export const MAX_STAGES = 8;

export interface MouseSettings {
  dpiStages?: number[];
  /** Index into dpiStages. */
  activeStage?: number;
  pollingHz?: number;
  /** #rrggbb. No mouse adapter writes lighting yet; kept so the profile is complete. */
  color?: string;
}

export interface KeyboardSettings {
  color?: string;
  /** Percent, 0-100. */
  brightness?: number;
  /** Effect numbers are vendor-specific, so an effect only applies within its protocol family. */
  effect?: { family: string; value: number };
}

/** A v1 profile that no mapping could convert: kept as saved, exportable, never applied. */
export interface V1Body {
  registryId: string;
  settings: Record<string, number>;
}

export interface Profile {
  id: string;
  name: string;
  savedAt: string;
  category: Category | 'v1';
  mouse?: MouseSettings;
  keyboard?: KeyboardSettings;
  v1?: V1Body;
}

export type Body = Omit<Profile, 'id' | 'savedAt'>;
/** Converts a v1 body (a device's own rows) into a category profile, or null when no mapping exists. */
export type Migrate = (v1: V1Body) => Pick<Profile, 'category' | 'mouse' | 'keyboard'> | null;

export const MAX_FILE_BYTES = 64 * 1024;
const MAX_NAME = 60;
const MAX_V1_SETTINGS = 64;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const HEX = /^#[0-9a-f]{6}$/i;
const FAMILY = /^[a-z0-9-]{1,40}$/;
const V1_KEY = 'udb-profiles-v1';
const STORAGE_KEY = 'udb-profiles-v2';

export type Store = Pick<Storage, 'getItem' | 'setItem'>;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const int = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
/** Null means invalid; undefined means absent. */
type Clean<T> = T | null | undefined;

function cleanMouse(v: unknown): Clean<MouseSettings> {
  if (v === undefined) return undefined;
  if (!isObject(v)) return null;
  const out: MouseSettings = {};
  if (v.dpiStages !== undefined) {
    if (!Array.isArray(v.dpiStages) || v.dpiStages.length < 1 || v.dpiStages.length > MAX_STAGES) return null;
    if (!v.dpiStages.every((d) => int(d, 1, 100_000))) return null;
    out.dpiStages = [...(v.dpiStages as number[])];
  }
  if (v.activeStage !== undefined) {
    if (!int(v.activeStage, 0, (out.dpiStages?.length ?? MAX_STAGES) - 1)) return null;
    out.activeStage = v.activeStage;
  }
  if (v.pollingHz !== undefined) {
    if (!(POLLING_RATES as readonly unknown[]).includes(v.pollingHz)) return null;
    out.pollingHz = v.pollingHz as number;
  }
  if (v.color !== undefined) {
    if (typeof v.color !== 'string' || !HEX.test(v.color)) return null;
    out.color = v.color.toLowerCase();
  }
  return Object.keys(out).length ? out : null;
}

function cleanKeyboard(v: unknown): Clean<KeyboardSettings> {
  if (v === undefined) return undefined;
  if (!isObject(v)) return null;
  const out: KeyboardSettings = {};
  if (v.color !== undefined) {
    if (typeof v.color !== 'string' || !HEX.test(v.color)) return null;
    out.color = v.color.toLowerCase();
  }
  if (v.brightness !== undefined) {
    if (!int(v.brightness, 0, 100)) return null;
    out.brightness = v.brightness;
  }
  if (v.effect !== undefined) {
    const e = v.effect;
    if (!isObject(e) || typeof e.family !== 'string' || !FAMILY.test(e.family) || !int(e.value, 0, 255)) return null;
    out.effect = { family: e.family, value: e.value };
  }
  return Object.keys(out).length ? out : null;
}

function cleanV1(v: unknown): Clean<V1Body> {
  if (v === undefined) return undefined;
  if (!isObject(v) || typeof v.registryId !== 'string' || !isObject(v.settings)) return null;
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(v.registryId)) return null;
  const entries = Object.entries(v.settings);
  if (entries.length === 0 || entries.length > MAX_V1_SETTINGS) return null;
  if (!entries.every(([k, n]) => KEY.test(k) && typeof n === 'number' && Number.isSafeInteger(n))) return null;
  return { registryId: v.registryId, settings: Object.fromEntries(entries) as Record<string, number> };
}

function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const name = v.trim();
  return name && name.length <= MAX_NAME ? name : null;
}

/** A well-formed v2 body, or null. Builds new objects, so nothing from the input is kept by reference. */
function clean(v: unknown): Body | null {
  if (!isObject(v)) return null;
  const name = cleanName(v.name);
  if (!name) return null;
  if (v.category === 'mouse') {
    const mouse = cleanMouse(v.mouse);
    return mouse ? { name, category: 'mouse', mouse } : null;
  }
  if (v.category === 'keyboard') {
    const keyboard = cleanKeyboard(v.keyboard);
    return keyboard ? { name, category: 'keyboard', keyboard } : null;
  }
  if (v.category === 'v1') {
    const v1 = cleanV1(v.v1);
    return v1 ? { name, category: 'v1', v1 } : null;
  }
  return null;
}

/** A v1 body (name, registryId, settings) converted where a mapping exists, kept as v1 otherwise. */
function fromV1(v: unknown, migrate: Migrate): Body | null {
  if (!isObject(v)) return null;
  const name = cleanName(v.name);
  const v1 = cleanV1({ registryId: v.registryId, settings: v.settings });
  if (!name || !v1) return null;
  const converted = migrate(v1);
  // The mapping's output goes through the same checks as anything else.
  return (converted && clean({ name, ...converted })) || { name, category: 'v1', v1 };
}

function read(store: Store, key: string): unknown[] | null {
  try {
    const raw: unknown = JSON.parse(store.getItem(key) ?? 'null');
    return Array.isArray(raw) ? raw : null;
  } catch {
    return null;
  }
}

const stamped = (p: unknown, body: Body | null): Profile[] =>
  body && isObject(p) && typeof p.id === 'string' && typeof p.savedAt === 'string' ? [{ id: p.id, savedAt: p.savedAt, ...body }] : [];

/**
 * The stored profiles. On the first load after the upgrade, v1 profiles are
 * converted and written under the v2 key; the v1 key is left as it was, so
 * going back to an older build loses nothing.
 */
export function loadProfiles(store: Store, migrate: Migrate): Profile[] {
  const v2 = read(store, STORAGE_KEY);
  if (v2) return v2.flatMap((p) => stamped(p, clean(p)));
  const v1 = read(store, V1_KEY);
  if (!v1) return [];
  const converted = v1.flatMap((p) => stamped(p, fromV1(p, migrate)));
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(converted));
  } catch {
    // Blocked storage: convert again next time.
  }
  return converted;
}

/** Adds or replaces (by id). Throws if the browser refuses to store it (quota). */
export function saveProfile(store: Store, profile: Profile, migrate: Migrate): void {
  const all = loadProfiles(store, migrate).filter((p) => p.id !== profile.id);
  store.setItem(STORAGE_KEY, JSON.stringify([...all, profile]));
}

export function deleteProfile(store: Store, id: string, migrate: Migrate): void {
  store.setItem(STORAGE_KEY, JSON.stringify(loadProfiles(store, migrate).filter((p) => p.id !== id)));
}

/** v2 files; a kept v1 profile exports in its own v1 format. */
export function serializeProfile(p: Profile): string {
  const body =
    p.category === 'v1'
      ? { udbProfile: 1, name: p.name, ...p.v1 }
      : { udbProfile: 2, name: p.name, category: p.category, [p.category]: p.category === 'mouse' ? p.mouse : p.keyboard };
  return JSON.stringify(body, null, 2);
}

export type ParseResult = { ok: true; profile: Body } | { ok: false; error: string };

export function parseProfile(text: string, migrate: Migrate): ParseResult {
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: 'The file is too large to be a UDB profile.' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (!isObject(raw) || (raw.udbProfile !== 1 && raw.udbProfile !== 2)) return { ok: false, error: 'This is not a UDB profile file.' };
  const body = raw.udbProfile === 1 ? fromV1(raw, migrate) : clean(raw);
  return body ? { ok: true, profile: body } : { ok: false, error: 'The profile has a missing or invalid name, category or setting.' };
}

/** This browser's localStorage, or null when it's blocked (private mode, policy). */
export function browserStore(): Store | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export function downloadProfile(p: Profile): void {
  const url = URL.createObjectURL(new Blob([serializeProfile(p)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `udb-profile-${p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** One line for a list: "400 · 800 · 1,600 DPI (stage 2) · 1,000 Hz". */
export function summary(p: Profile): string {
  const parts: string[] = [];
  if (p.mouse) {
    const m = p.mouse;
    if (m.dpiStages) parts.push(`${m.dpiStages.map((d) => d.toLocaleString()).join(' · ')} DPI${m.activeStage !== undefined && m.dpiStages.length > 1 ? ` (stage ${m.activeStage + 1})` : ''}`);
    else if (m.activeStage !== undefined) parts.push(`stage ${m.activeStage + 1}`);
    if (m.pollingHz) parts.push(`${m.pollingHz.toLocaleString()} Hz`);
    if (m.color) parts.push('colour');
  }
  if (p.keyboard) {
    const k = p.keyboard;
    if (k.color) parts.push('colour');
    if (k.brightness !== undefined) parts.push(`${k.brightness}% brightness`);
    if (k.effect) parts.push(`effect ${k.effect.value}`);
  }
  if (p.v1) parts.push(`${Object.keys(p.v1.settings).length} settings saved from ${p.v1.registryId}`);
  return parts.join(' · ');
}
