import { describe, expect, it } from 'vitest';
import { deleteProfile, loadProfiles, parseProfile, saveProfile, serializeProfile, type Profile, type Store } from '../src/lib/profiles.ts';

const memory = (initial?: string): Store & { data: Map<string, string> } => {
  const data = new Map<string, string>(initial === undefined ? [] : [['udb-profiles-v1', initial]]);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

const profile = (over: Partial<Profile> = {}): Profile => ({
  id: 'a',
  name: 'Quiet mode',
  registryId: 'razer/deathadder-v3-pro',
  savedAt: '2026-10-18T12:00:00.000Z',
  settings: { dpi: 800, polling: 1000 },
  ...over,
});

describe('profile storage', () => {
  it('saves, lists, replaces by id and deletes', () => {
    const store = memory();
    saveProfile(store, profile());
    saveProfile(store, profile({ id: 'b', name: 'Loud' }));
    saveProfile(store, profile({ name: 'Quiet mode v2' }));
    expect(loadProfiles(store).map((p) => [p.id, p.name])).toEqual([['b', 'Loud'], ['a', 'Quiet mode v2']]);
    deleteProfile(store, 'b');
    expect(loadProfiles(store).map((p) => p.id)).toEqual(['a']);
  });

  it('survives corrupt or hand-edited storage', () => {
    expect(loadProfiles(memory('not json'))).toEqual([]);
    expect(loadProfiles(memory('{"a":1}'))).toEqual([]);
    expect(loadProfiles(memory(JSON.stringify([profile(), { id: 'x', name: 'bad', settings: { dpi: 'high' } }])))).toHaveLength(1);
    expect(loadProfiles({ getItem: () => null, setItem: () => {} })).toEqual([]);
  });
});

describe('profile files', () => {
  it('round-trips through export and import', () => {
    const result = parseProfile(serializeProfile(profile()));
    expect(result).toEqual({ ok: true, profile: { name: 'Quiet mode', registryId: 'razer/deathadder-v3-pro', settings: { dpi: 800, polling: 1000 } } });
  });

  const body = (over: object) => JSON.stringify({ udbProfile: 1, name: 'n', registryId: 'a/b', settings: { dpi: 800 }, ...over });
  it.each([
    ['not JSON', 'nope'],
    ['an array', '[]'],
    ['another file kind', JSON.stringify({ udbReport: 1 })],
    ['a future version', body({ udbProfile: 2 })],
    ['an empty name', body({ name: '  ' })],
    ['a long name', body({ name: 'x'.repeat(61) })],
    ['a registry id with a path in it', body({ registryId: '../../etc/passwd' })],
    ['no settings', body({ settings: {} })],
    ['a fractional value', body({ settings: { dpi: 800.5 } })],
    ['a string value', body({ settings: { dpi: '800' } })],
    ['a non-finite value', '{"udbProfile":1,"name":"n","registryId":"a/b","settings":{"dpi":1e999}}'],
    ['a key that is not a setting id', body({ settings: { 'dpi stage': 800 } })],
    ['a __proto__ key', '{"udbProfile":1,"name":"n","registryId":"a/b","settings":{"__proto__":1}}'],
    ['too many settings', body({ settings: Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`s${i}`, i])) })],
    ['a file over 64 KiB', body({ pad: 'x'.repeat(70_000) })],
  ])('rejects %s', (_label, text) => {
    expect(parseProfile(text).ok).toBe(false);
  });

  it('ignores unknown extra fields instead of keeping them', () => {
    const result = parseProfile(body({ extra: { evil: true } }));
    expect(result.ok && Object.keys(result.profile).sort()).toEqual(['name', 'registryId', 'settings']);
  });
});
