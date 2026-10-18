// Browser profiles (SPEC: Profiles): a named set of values a device returned,
// kept in this browser and exportable as a file. Applying one writes each value
// through the panel's write procedure, so every value is read back. Nothing here
// touches a device or the network.
//
// Imported files are untrusted: size, shape and every key and value are checked
// before anything is stored.

export interface Profile {
  id: string;
  name: string;
  /** The registry entry it was saved from; a profile only lists under that entry. */
  registryId: string;
  savedAt: string;
  /** Row key (a panel's own setting id, e.g. `dpi0`) to the value the device returned. */
  settings: Record<string, number>;
}

export const MAX_FILE_BYTES = 64 * 1024;
const MAX_NAME = 60;
const MAX_SETTINGS = 64;
const KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/;
const STORAGE_KEY = 'udb-profiles-v1';

export type Store = Pick<Storage, 'getItem' | 'setItem'>;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A well-formed profile body, or null. Builds new objects, so nothing from the input is kept by reference. */
function clean(v: unknown): { name: string; registryId: string; settings: Record<string, number> } | null {
  if (!isObject(v) || typeof v.name !== 'string' || typeof v.registryId !== 'string' || !isObject(v.settings)) return null;
  const name = v.name.trim();
  if (!name || name.length > MAX_NAME || !/^[a-z0-9-]+\/[a-z0-9-]+$/.test(v.registryId)) return null;
  const entries = Object.entries(v.settings);
  if (entries.length === 0 || entries.length > MAX_SETTINGS) return null;
  if (!entries.every(([k, n]) => KEY.test(k) && typeof n === 'number' && Number.isSafeInteger(n))) return null;
  return { name, registryId: v.registryId, settings: Object.fromEntries(entries) as Record<string, number> };
}

export function loadProfiles(store: Store): Profile[] {
  let raw: unknown;
  try {
    raw = JSON.parse(store.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((p): Profile[] => {
    const body = clean(p);
    return body && typeof p.id === 'string' && typeof p.savedAt === 'string' ? [{ id: p.id, savedAt: p.savedAt, ...body }] : [];
  });
}

/** Adds or replaces (by id). Throws if the browser refuses to store it (quota). */
export function saveProfile(store: Store, profile: Profile): void {
  const all = loadProfiles(store).filter((p) => p.id !== profile.id);
  store.setItem(STORAGE_KEY, JSON.stringify([...all, profile]));
}

export function deleteProfile(store: Store, id: string): void {
  store.setItem(STORAGE_KEY, JSON.stringify(loadProfiles(store).filter((p) => p.id !== id)));
}

export function serializeProfile(p: Profile): string {
  return JSON.stringify({ udbProfile: 1, name: p.name, registryId: p.registryId, settings: p.settings }, null, 2);
}

export type ParseResult = { ok: true; profile: Omit<Profile, 'id' | 'savedAt'> } | { ok: false; error: string };

export function parseProfile(text: string): ParseResult {
  if (text.length > MAX_FILE_BYTES) return { ok: false, error: 'The file is too large to be a UDB profile.' };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (!isObject(raw) || raw.udbProfile !== 1) return { ok: false, error: 'This is not a UDB profile file.' };
  const body = clean(raw);
  return body ? { ok: true, profile: body } : { ok: false, error: 'The profile has a missing or invalid name, device or setting.' };
}
