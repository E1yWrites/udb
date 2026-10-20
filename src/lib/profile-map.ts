// How each live panel's own rows map to a category profile, and back.
// Rows are what the panel reads: a row key (`dpi0`, `pollingRate`,
// `rgbMatrix.hue`) to the value the device last returned. Saving reads rows into
// a profile; applying plans the row writes, and the panel does each one through
// its write procedure, read back. Anything the device can't take is a note
// with the reason, never a silent change.

import { hexToHueSat, hueSatToHex } from './color.ts';
import { registry } from './registry.ts';
import type { KeyboardSettings, Migrate, MouseSettings } from './profiles.ts';

export type Rows = Record<string, number | null | undefined>;
/** `unreadable`: rows the profile sets whose current value couldn't be read, so they aren't written. */
export type Plan = { writes: { row: string; value: number }[]; notes: string[]; unreadable: string[] };

const num = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const numbered = (rows: Rows, prefix: string) =>
  Object.keys(rows)
    .filter((k) => k.startsWith(prefix) && /^\d+$/.test(k.slice(prefix.length)))
    .sort((a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length)));

interface MouseShape {
  /** The DPI rows in stage order. */
  stages: (rows: Rows) => string[];
  active?: { row: string; toIndex: (v: number, stages: string[]) => number | null; fromIndex: (i: number, stages: string[]) => number | null };
  polling?: string;
}

export interface MouseMap {
  category: 'mouse';
  toProfile: (rows: Rows) => MouseSettings;
  plan: (m: MouseSettings, rows: Rows) => Plan;
}

export interface KeyboardMap {
  category: 'keyboard';
  toProfile: (rows: Rows) => KeyboardSettings;
  plan: (k: KeyboardSettings, rows: Rows) => Plan;
}

/** Writes in the panel's own row order; a row whose value couldn't be read isn't written. */
function finish(rows: Rows, wanted: Map<string, number>, notes: string[]): Plan {
  const writes: Plan['writes'] = [];
  const unreadable: string[] = [];
  for (const row of Object.keys(rows)) {
    const value = wanted.get(row);
    if (value === undefined) continue;
    if (rows[row] == null) unreadable.push(row);
    else writes.push({ row, value });
  }
  return { writes, notes, unreadable };
}

function mouse(shape: MouseShape): MouseMap {
  return {
    category: 'mouse',
    toProfile(rows) {
      const out: MouseSettings = {};
      const stages = shape.stages(rows);
      const values = stages.map((r) => rows[r]);
      if (values.length && values.every(num)) out.dpiStages = values as number[];
      const a = shape.active && rows[shape.active.row];
      if (shape.active && num(a)) {
        const i = shape.active.toIndex(a, stages);
        if (i !== null) out.activeStage = i;
      } else if (out.dpiStages?.length === 1) out.activeStage = 0;
      const hz = shape.polling && rows[shape.polling];
      if (num(hz)) out.pollingHz = hz;
      return out;
    },
    plan(m, rows) {
      const wanted = new Map<string, number>();
      const notes: string[] = [];
      const stages = shape.stages(rows);
      const want = m.dpiStages ?? [];
      if (want.length && stages.length === 1 && want.length > 1) {
        const i = m.activeStage ?? 0;
        wanted.set(stages[0]!, want[i]!);
        notes.push(`This mouse has one DPI setting, so it gets the profile's active stage (stage ${i + 1}, ${want[i]!.toLocaleString()} DPI).`);
      } else if (want.length && stages.length) {
        stages.forEach((r, i) => i < want.length && wanted.set(r, want[i]!));
        if (want.length > stages.length) notes.push(`The profile has ${want.length} DPI stages and this mouse ${stages.length}; stages ${stages.length + 1} to ${want.length} were not written.`);
        if (want.length < stages.length) notes.push(`This mouse has ${stages.length} DPI stages and the profile ${want.length}; the others were left as they are.`);
      } else if (want.length) notes.push('This mouse has no DPI setting UDB can change.');
      if (m.activeStage !== undefined && shape.active && stages.length > 1) {
        const v = shape.active.fromIndex(m.activeStage, stages);
        if (v === null) notes.push(`Active stage: this mouse has no stage ${m.activeStage + 1}.`);
        else wanted.set(shape.active.row, v);
      }
      if (m.pollingHz !== undefined) {
        if (shape.polling && shape.polling in rows) wanted.set(shape.polling, m.pollingHz);
        else notes.push('This mouse has no polling-rate setting UDB can change.');
      }
      if (m.color) notes.push("Colour: UDB can't write this mouse's lighting yet, so it was not sent.");
      return finish(rows, wanted, notes);
    },
  };
}

/** QMK/VIA rows are `<channel>.<part>`; colour goes to every channel that has one. */
const via: KeyboardMap = {
  category: 'keyboard',
  toProfile(rows) {
    const out: KeyboardSettings = {};
    const chs = channels(rows);
    const c = chs.find((ch) => num(rows[`${ch}.hue`]) && num(rows[`${ch}.sat`]));
    if (c) out.color = hueSatToHex(rows[`${c}.hue`]!, rows[`${c}.sat`]!);
    const b = chs.find((ch) => num(rows[`${ch}.brightness`]));
    if (b) out.brightness = Math.round((rows[`${b}.brightness`]! * 100) / 255);
    const e = chs.find((ch) => num(rows[`${ch}.effect`]));
    if (e) out.effect = { family: 'qmk-via', value: rows[`${e}.effect`]! };
    return out;
  },
  plan(k, rows) {
    const wanted = new Map<string, number>();
    const notes: string[] = [];
    const chs = channels(rows);
    if (k.color) {
      const hs = hexToHueSat(k.color)!;
      const targets = chs.filter((ch) => `${ch}.hue` in rows);
      for (const ch of targets) wanted.set(`${ch}.hue`, hs.hue).set(`${ch}.sat`, hs.sat);
      if (!targets.length) notes.push('This keyboard has no colour setting UDB can change.');
    }
    if (k.brightness !== undefined) {
      const targets = chs.filter((ch) => `${ch}.brightness` in rows);
      for (const ch of targets) wanted.set(`${ch}.brightness`, Math.round((k.brightness * 255) / 100));
      if (!targets.length) notes.push('This keyboard has no brightness setting UDB can change.');
    }
    if (k.effect) {
      const target = chs.find((ch) => `${ch}.effect` in rows);
      if (k.effect.family !== 'qmk-via') notes.push(`Effect: saved from a ${k.effect.family} keyboard, and effect numbers don't carry across brands, so it was not sent.`);
      else if (target) wanted.set(`${target}.effect`, k.effect.value);
      else notes.push('This keyboard has no effect setting UDB can change.');
    }
    return finish(rows, wanted, notes);
  },
};

function channels(rows: Rows): string[] {
  return [...new Set(Object.keys(rows).map((k) => k.split('.')[0]!))];
}

/** Protocol family to its mapping. A family without one has no profiles. */
export const MAPPINGS: Record<string, MouseMap | KeyboardMap> = {
  compx: mouse({
    stages: (rows) => numbered(rows, 'dpi'),
    active: { row: 'activeStage', toIndex: (v) => v, fromIndex: (i, stages) => (i < stages.length ? i : null) },
    polling: 'pollingRate',
  }),
  razer: mouse({ stages: (rows) => ('dpi' in rows ? ['dpi'] : []), polling: 'polling' }),
  'logitech-hidpp': mouse({ stages: (rows) => ('dpi' in rows ? ['dpi'] : []), polling: 'rate' }),
  // Stage 0 is the Sniper stage, which a profile's stages don't map onto.
  'corsair-nxp': mouse({
    stages: (rows) => numbered(rows, 'stage').filter((r) => r !== 'stage0'),
    active: {
      row: 'active',
      toIndex: (v, stages) => (stages.indexOf(`stage${v}`) === -1 ? null : stages.indexOf(`stage${v}`)),
      fromIndex: (i, stages) => (stages[i] ? Number(stages[i]!.slice(5)) : null),
    },
  }),
  'qmk-via': via,
};

/** The mapping for a device, when its category and family have one. */
export function mappingFor(family: string, category: string): MouseMap | KeyboardMap | null {
  const m = MAPPINGS[family];
  return m && m.category === category ? m : null;
}

/** Converts a v1 profile through the registry entry it was saved from. */
export const migrateV1: Migrate = (v1) => {
  const entry = registry.find((e) => e.id === v1.registryId);
  const m = entry && mappingFor(entry.protocol.family, entry.category);
  if (!m) return null;
  const settings = m.toProfile(v1.settings);
  if (!Object.keys(settings).length) return null;
  return m.category === 'mouse' ? { category: 'mouse', mouse: settings as MouseSettings } : { category: 'keyboard', keyboard: settings as KeyboardSettings };
};
