import { describe, expect, it } from 'vitest';
import { extent, parseViaDefinition, visibleKeys, type ViaDefinition } from '../src/adapters/via-definition.ts';
import { KEYCODES, KEYCODE_GROUPS, isNamed, keycodeName, keycodeShort } from '../src/adapters/via-keycodes.ts';

// Written for these tests to the VIA definition format; not a real keyboard's file.
const definition = (over: object = {}) =>
  JSON.stringify({
    name: 'Test 60',
    vendorProductId: 0x12345678,
    matrix: { rows: 2, cols: 3 },
    layouts: {
      labels: [['Backspace', 'Normal', 'Split'], 'Winkey'],
      keymap: [
        ['0,0', '0,1', { w: 2 }, '0,2\n\n\n\n\n\n\n\n\n0,0'],
        [{ x: 0.5 }, '1,0', '1,1\n\n\n\n\n\n\n\n\n0,1', '1,2\n\n\n\n\n\n\n\n\n1,1', '0,0\n\n\n\n\n\n\n\n\ne'],
      ],
    },
    ...over,
  });

describe('VIA definition', () => {
  const parsed = parseViaDefinition(definition());
  const def = (parsed.ok ? parsed.definition : null) as ViaDefinition;

  it('reads the device, matrix and keys, with positions from the KLE layout', () => {
    expect(parsed.ok).toBe(true);
    expect([def.name, def.vendorId, def.productId, def.rows, def.cols]).toEqual(['Test 60', 0x1234, 0x5678, 2, 3]);
    expect(def.keys.map((k) => [k.row, k.col, k.x, k.y, k.w])).toEqual([
      [0, 0, 0, 0, 1],
      [0, 1, 1, 0, 1],
      [0, 2, 2, 0, 2],
      [1, 0, 0.5, 1, 1],
      [1, 1, 1.5, 1, 1],
      [1, 2, 2.5, 1, 1],
    ]);
    expect(def.options).toEqual([{ name: 'Backspace', choices: ['Normal', 'Split'] }, { name: 'Winkey', choices: ['Off', 'On'] }]);
  });

  it('skips encoder keys and reads layout options', () => {
    expect(def.keys.some((k) => k.row === 0 && k.col === 0 && k.y === 1)).toBe(false);
    expect(def.keys.find((k) => k.col === 2 && k.row === 0)?.option).toEqual({ group: 0, choice: 0 });
  });

  it('shows the chosen variant of each option and every key outside an option', () => {
    expect(visibleKeys(def, [0, 0]).map((k) => `${k.row},${k.col}`)).toEqual(['0,0', '0,1', '0,2', '1,0']);
    expect(visibleKeys(def, [1, 1]).map((k) => `${k.row},${k.col}`)).toEqual(['0,0', '0,1', '1,0', '1,1', '1,2']);
  });

  it('measures the drawing, including rotated keys', () => {
    expect(extent(def.keys)).toMatchObject({ w: 4, h: 2 });
    const rotated = extent([{ row: 0, col: 0, x: 1, y: 0, w: 1, h: 1, r: 90, rx: 0, ry: 0 }]);
    expect(rotated.w).toBeCloseTo(1);
    expect(rotated.minX).toBeCloseTo(-1);
  });

  it('accepts the older vendorId and productId strings', () => {
    const old = parseViaDefinition(definition({ vendorProductId: undefined, vendorId: '0x3434', productId: '0x0111' }));
    expect(old.ok && [old.definition.vendorId, old.definition.productId]).toEqual([0x3434, 0x0111]);
  });

  const withKeymap = (keymap: unknown) => definition({ layouts: { keymap } });
  it.each([
    ['not JSON', 'nope'],
    ['an array', '[]'],
    ['no matrix', JSON.stringify({ vendorProductId: 1, layouts: { keymap: [] } })],
    ['no USB ids', definition({ vendorProductId: undefined })],
    ['a matrix that is too big', definition({ matrix: { rows: 65, cols: 3 } })],
    ['a fractional matrix', definition({ matrix: { rows: 2.5, cols: 3 } })],
    ['a key outside the matrix', withKeymap([['2,0']])],
    ['a key that refers to a missing option', withKeymap([['0,0\n\n\n\n\n\n\n\n\n3,0']])],
    ['a non-finite or huge coordinate', withKeymap([[{ x: 1e9 }, '0,0']])],
    ['a layout row that is not an array', withKeymap(['0,0'])],
    ['a layout item that is a number', withKeymap([[5]])],
    ['no keys at all', withKeymap([[{ x: 1 }]])],
    ['too many keys', withKeymap([Array.from({ length: 513 }, () => '0,0')])],
    ['a file over 512 KiB', definition({ pad: 'x'.repeat(530_000) })],
  ])('rejects %s', (_name, text) => {
    expect(parseViaDefinition(text).ok).toBe(false);
  });

  it('ignores a legend that is not a matrix position (decals, labels)', () => {
    const r = parseViaDefinition(withKeymap([['0,0', 'Fn', '0,1']]));
    expect(r.ok && r.definition.keys.map((k) => [k.col, k.x])).toEqual([[0, 0], [1, 2]]);
  });
});

describe('basic keycode names', () => {
  it('names keys by QMK keycodes.h values', () => {
    expect([0x04, 0x1d, 0x1e, 0x27, 0x28, 0x2c, 0x3a, 0x73, 0xe0, 0xe7, 0xa8, 0xbe].map(keycodeName)).toEqual([
      'A', 'Z', '1', '0', 'Enter', 'Space', 'F1', 'F24', 'Left Ctrl', 'Right GUI (Windows)', 'Mute', 'Brightness Down',
    ]);
    expect(keycodeShort(0x28)).toBe('Ent');
  });

  it('shows anything it does not name as a hex number and never lists it as a choice', () => {
    expect(keycodeName(0x5220)).toBe('0x5220');
    expect(isNamed(0x5220)).toBe(false);
    expect(isNamed(0x7c00)).toBe(false);
    expect(KEYCODES.every((k) => k.code <= 0xff)).toBe(true);
  });

  it('has no duplicate codes and every group is non-empty', () => {
    expect(new Set(KEYCODES.map((k) => k.code)).size).toBe(KEYCODES.length);
    expect(KEYCODE_GROUPS.every((g) => g.keys.length > 0)).toBe(true);
  });
});
