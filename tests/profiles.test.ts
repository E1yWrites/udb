import { describe, expect, it } from 'vitest';
import { deleteProfile, loadProfiles, parseProfile, saveProfile, serializeProfile, type Profile, type Store } from '../src/lib/profiles.ts';
import { MAPPINGS, mappingFor, migrateV1 } from '../src/lib/profile-map.ts';

const memory = (seed: Record<string, string> = {}): Store & { data: Map<string, string> } => {
  const data = new Map(Object.entries(seed));
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

const mouse = (over: Partial<Profile> = {}): Profile => ({
  id: 'a',
  name: 'Quiet mode',
  savedAt: '2026-10-19T12:00:00.000Z',
  category: 'mouse',
  mouse: { dpiStages: [400, 800, 1600], activeStage: 1, pollingHz: 1000 },
  ...over,
});

describe('profile storage', () => {
  it('saves, lists, replaces by id and deletes', () => {
    const store = memory();
    saveProfile(store, mouse(), migrateV1);
    saveProfile(store, mouse({ id: 'b', name: 'Loud' }), migrateV1);
    saveProfile(store, mouse({ name: 'Quiet mode v2' }), migrateV1);
    expect(loadProfiles(store, migrateV1).map((p) => [p.id, p.name])).toEqual([['b', 'Loud'], ['a', 'Quiet mode v2']]);
    deleteProfile(store, 'b', migrateV1);
    expect(loadProfiles(store, migrateV1).map((p) => p.id)).toEqual(['a']);
  });

  it('survives corrupt or hand-edited storage', () => {
    const v2 = (x: string) => memory({ 'udb-profiles-v2': x });
    expect(loadProfiles(v2('not json'), migrateV1)).toEqual([]);
    expect(loadProfiles(v2('{"a":1}'), migrateV1)).toEqual([]);
    expect(loadProfiles(v2(JSON.stringify([mouse(), { ...mouse({ id: 'x' }), mouse: { dpiStages: ['high'] } }])), migrateV1)).toHaveLength(1);
    expect(loadProfiles({ getItem: () => null, setItem: () => {} }, migrateV1)).toEqual([]);
  });

  it('converts v1 profiles once, keeps what it cannot convert, and leaves the v1 key alone', () => {
    const v1 = [
      { id: 'r', name: 'Razer 800', registryId: 'razer/deathadder-v3-pro', savedAt: 's', settings: { dpi: 800, polling: 1000, sleep: 300 } },
      { id: 'h', name: 'Headset', registryId: 'logitech/g933-headset', savedAt: 's', settings: { sidetone: 40 } },
      { id: 'u', name: 'Unknown', registryId: 'nobody/nothing', savedAt: 's', settings: { x: 1 } },
    ];
    const store = memory({ 'udb-profiles-v1': JSON.stringify(v1) });
    const all = loadProfiles(store, migrateV1);
    expect(all.find((p) => p.id === 'r')).toMatchObject({ category: 'mouse', mouse: { dpiStages: [800], activeStage: 0, pollingHz: 1000 } });
    expect(all.find((p) => p.id === 'h')).toMatchObject({ category: 'v1', v1: { registryId: 'logitech/g933-headset', settings: { sidetone: 40 } } });
    expect(all.find((p) => p.id === 'u')?.category).toBe('v1');
    expect(store.data.get('udb-profiles-v1')).toBe(JSON.stringify(v1));
    expect(JSON.parse(store.data.get('udb-profiles-v2')!)).toHaveLength(3);
  });
});

describe('profile files', () => {
  it('round-trips a mouse and a keyboard profile', () => {
    expect(parseProfile(serializeProfile(mouse()), migrateV1)).toEqual({
      ok: true,
      profile: { name: 'Quiet mode', category: 'mouse', mouse: { dpiStages: [400, 800, 1600], activeStage: 1, pollingHz: 1000 } },
    });
    const kb = mouse({ category: 'keyboard', mouse: undefined, keyboard: { color: '#49AA57', brightness: 80, effect: { family: 'qmk-via', value: 3 } } });
    const back = parseProfile(serializeProfile(kb), migrateV1);
    expect(back.ok && back.profile.keyboard).toEqual({ color: '#49aa57', brightness: 80, effect: { family: 'qmk-via', value: 3 } });
  });

  it('imports a v1 file by converting it', () => {
    const text = JSON.stringify({ udbProfile: 1, name: 'Old', registryId: 'razer/deathadder-v3-pro', settings: { dpi: 1600 } });
    const r = parseProfile(text, migrateV1);
    expect(r.ok && r.profile).toEqual({ name: 'Old', category: 'mouse', mouse: { dpiStages: [1600], activeStage: 0 } });
  });

  const body = (over: object) => JSON.stringify({ udbProfile: 2, name: 'n', category: 'mouse', mouse: { dpiStages: [800] }, ...over });
  it.each([
    ['not JSON', 'nope'],
    ['an array', '[]'],
    ['another file kind', JSON.stringify({ udbReport: 1 })],
    ['a future version', body({ udbProfile: 3 })],
    ['an unknown category', body({ category: 'headset' })],
    ['an empty name', body({ name: '  ' })],
    ['a long name', body({ name: 'x'.repeat(61) })],
    ['no settings', body({ mouse: {} })],
    ['too many DPI stages', body({ mouse: { dpiStages: [1, 2, 3, 4, 5, 6, 7, 8, 9] } })],
    ['a fractional DPI', body({ mouse: { dpiStages: [800.5] } })],
    ['a string DPI', body({ mouse: { dpiStages: ['800'] } })],
    ['a non-finite DPI', '{"udbProfile":2,"name":"n","category":"mouse","mouse":{"dpiStages":[1e999]}}'],
    ['an active stage past the stages', body({ mouse: { dpiStages: [800], activeStage: 1 } })],
    ['a polling rate no mouse has', body({ mouse: { pollingHz: 1234 } })],
    ['a colour that is not #rrggbb', body({ mouse: { color: 'red' } })],
    ['a brightness over 100', body({ category: 'keyboard', keyboard: { brightness: 101 } })],
    ['an effect family with a path in it', body({ category: 'keyboard', keyboard: { effect: { family: '../x', value: 1 } } })],
    ['a v1 registry id with a path in it', JSON.stringify({ udbProfile: 1, name: 'n', registryId: '../../etc/passwd', settings: { dpi: 800 } })],
    ['a v1 __proto__ key', '{"udbProfile":1,"name":"n","registryId":"a/b","settings":{"__proto__":1}}'],
    ['a file over 64 KiB', body({ pad: 'x'.repeat(70_000) })],
  ])('rejects %s', (_label, text) => {
    expect(parseProfile(text, migrateV1).ok).toBe(false);
  });

  it('drops unknown extra fields instead of keeping them', () => {
    const r = parseProfile(body({ extra: { evil: true }, mouse: { dpiStages: [800], evil: 1 } }), migrateV1);
    expect(r.ok && r.profile).toEqual({ name: 'n', category: 'mouse', mouse: { dpiStages: [800] } });
  });
});

describe('profile mapping', () => {
  const compxRows = { pollingRate: 1000, activeStage: 1, debounce: 2, dpi0: 400, dpi1: 800, dpi2: 1600, dpi3: 3200 };

  it('reads a device into a profile', () => {
    expect(MAPPINGS.compx!.toProfile(compxRows)).toEqual({ dpiStages: [400, 800, 1600, 3200], activeStage: 1, pollingHz: 1000 });
    expect(MAPPINGS['qmk-via']!.toProfile({ 'rgbMatrix.brightness': 255, 'rgbMatrix.effect': 4, 'rgbMatrix.speed': 9, 'rgbMatrix.hue': 85, 'rgbMatrix.sat': 255 })).toEqual({
      color: '#00ff00',
      brightness: 100,
      effect: { family: 'qmk-via', value: 4 },
    });
    expect(MAPPINGS['corsair-nxp']!.toProfile({ active: 2, stage0: 400, stage1: 1500, stage2: 3000, lift: 3 })).toEqual({ dpiStages: [1500, 3000], activeStage: 1 });
  });

  it('plans writes in row order and says what it skipped', () => {
    const plan = MAPPINGS.compx!.plan({ dpiStages: [500, 1000], activeStage: 1, pollingHz: 4000, color: '#ff0000' }, compxRows);
    expect(plan.writes).toEqual([
      { row: 'pollingRate', value: 4000 },
      { row: 'activeStage', value: 1 },
      { row: 'dpi0', value: 500 },
      { row: 'dpi1', value: 1000 },
    ]);
    expect(plan.notes.join(' ')).toMatch(/4 DPI stages and the profile 2/);
    expect(plan.notes.join(' ')).toMatch(/can't write this mouse's lighting/);
  });

  it('gives a one-DPI mouse the active stage, and names missing stages', () => {
    const razer = MAPPINGS.razer!.plan({ dpiStages: [400, 800, 1600], activeStage: 2 }, { dpi: 800, polling: 1000, sleep: 300 });
    expect(razer.writes).toEqual([{ row: 'dpi', value: 1600 }]);
    expect(razer.notes[0]).toMatch(/one DPI setting.*stage 3/);
    const many = MAPPINGS.compx!.plan({ dpiStages: [1, 2, 3, 4, 5, 6] }, compxRows);
    expect(many.notes[0]).toMatch(/stages 5 to 6 were not written/);
    const gone = MAPPINGS.compx!.plan({ dpiStages: [400, 800, 1600, 3200, 6400], activeStage: 4 }, compxRows);
    expect(gone.notes.join(' ')).toMatch(/no stage 5/);
  });

  it('keeps vendor effects within their family and skips unreadable rows', () => {
    const rows = { 'rgbMatrix.brightness': 200, 'rgbMatrix.effect': null, 'rgbMatrix.hue': 0, 'rgbMatrix.sat': 0 };
    const plan = MAPPINGS['qmk-via']!.plan({ color: '#0000ff', brightness: 50, effect: { family: 'qmk-via', value: 2 } }, rows);
    expect(plan.writes).toEqual([
      { row: 'rgbMatrix.brightness', value: 128 },
      { row: 'rgbMatrix.hue', value: 170 },
      { row: 'rgbMatrix.sat', value: 255 },
    ]);
    expect(plan.unreadable).toEqual(['rgbMatrix.effect']);
    const other = MAPPINGS['qmk-via']!.plan({ effect: { family: 'wooting', value: 2 } }, { 'rgbMatrix.effect': 1 });
    expect(other.writes).toEqual([]);
    expect(other.notes[0]).toMatch(/don't carry across brands/);
  });

  it('offers profiles only for mice and keyboards with a mapping', () => {
    expect(mappingFor('compx', 'mouse')?.category).toBe('mouse');
    expect(mappingFor('logitech-hidpp', 'headset')).toBeNull();
    expect(mappingFor('lamparray', 'keyboard')).toBeNull();
  });
});
