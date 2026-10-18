// A VIA keyboard definition, the JSON file the user loads (the-via/keyboards and
// keyboard repositories publish them). UDB reads only what it needs: the USB IDs
// it is for, the matrix size, the key layout, and the layout-option labels.
//
// The file is untrusted input: size, shape and every number are checked here, and
// the matrix size then bounds the keymap commands the allowlist accepts.

export interface ViaKey {
  row: number;
  col: number;
  /** In key units (1 = a standard key), before rotation. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rotation in degrees about (rx, ry). */
  r: number;
  rx: number;
  ry: number;
  /** Present when the key belongs to one choice of a layout option. */
  option?: { group: number; choice: number };
}

export interface ViaOption {
  name: string;
  /** A two-way option reads `Off` and `On`. */
  choices: string[];
}

export interface ViaDefinition {
  name: string;
  vendorId: number;
  productId: number;
  rows: number;
  cols: number;
  keys: ViaKey[];
  options: ViaOption[];
}

export type ParseResult = { ok: true; definition: ViaDefinition } | { ok: false; error: string };

export const MAX_FILE_BYTES = 512 * 1024;
const MAX_MATRIX = 64;
const MAX_KEYS = 512;
const MAX_OPTIONS = 16;
const MAX_COORD = 1000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const coord = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_COORD;
const fail = (error: string): ParseResult => ({ ok: false, error });

/** `vendorProductId` (vendor << 16 | product) or the older `vendorId` and `productId` strings. */
function ids(raw: Record<string, unknown>): { vendorId: number; productId: number } | null {
  const num = (v: unknown) => (typeof v === 'number' ? v : typeof v === 'string' && /^(0x[0-9a-f]{1,4}|\d{1,5})$/i.test(v) ? Number(v) : NaN);
  const vp = num(raw.vendorProductId);
  if (Number.isInteger(vp) && vp >= 0 && vp <= 0xffffffff) return { vendorId: vp >>> 16, productId: vp & 0xffff };
  const v = num(raw.vendorId);
  const p = num(raw.productId);
  return isInt(v, 0, 0xffff) && isInt(p, 0, 0xffff) ? { vendorId: v, productId: p } : null;
}

function options(labels: unknown): ViaOption[] | null {
  if (labels === undefined) return [];
  if (!Array.isArray(labels) || labels.length > MAX_OPTIONS) return null;
  const out: ViaOption[] = [];
  for (const l of labels) {
    if (typeof l === 'string') out.push({ name: l.slice(0, 60), choices: ['Off', 'On'] });
    else if (Array.isArray(l) && l.length >= 2 && l.length <= 17 && l.every((x): x is string => typeof x === 'string')) {
      const [name, ...choices] = l;
      out.push({ name: name!.slice(0, 60), choices: choices.map((c) => c.slice(0, 60)) });
    } else return null;
  }
  return out;
}

export function parseViaDefinition(text: string): ParseResult {
  if (text.length > MAX_FILE_BYTES) return fail('The file is too large to be a VIA definition.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail('The file is not valid JSON.');
  }
  if (!isObject(raw) || !isObject(raw.matrix) || !isObject(raw.layouts) || !Array.isArray(raw.layouts.keymap)) return fail('This is not a VIA keyboard definition.');
  const id = ids(raw);
  if (!id) return fail('The definition does not say which USB device it is for.');
  const { rows, cols } = raw.matrix;
  if (!isInt(rows, 1, MAX_MATRIX) || !isInt(cols, 1, MAX_MATRIX)) return fail(`The matrix size must be 1 to ${MAX_MATRIX} rows and columns.`);
  const opts = options(raw.layouts.labels);
  if (!opts) return fail('The layout option labels are not in a form UDB understands.');

  const keys: ViaKey[] = [];
  let r = 0, rx = 0, ry = 0, y = 0;
  for (const line of raw.layouts.keymap) {
    if (!Array.isArray(line)) return fail('The key layout is malformed.');
    let x = rx;
    let w = 1, h = 1;
    for (const item of line) {
      if (isObject(item)) {
        // KLE properties. Only position, size and rotation matter here.
        for (const k of ['x', 'y', 'w', 'h', 'r', 'rx', 'ry'] as const) if (item[k] !== undefined && !coord(item[k])) return fail('The key layout has an invalid number.');
        if (item.r !== undefined) r = item.r as number;
        if (item.rx !== undefined) (rx = item.rx as number), (x = rx);
        if (item.ry !== undefined) (ry = item.ry as number), (y = ry);
        if (item.x !== undefined) x += item.x as number;
        if (item.y !== undefined) y += item.y as number;
        if (item.w !== undefined) w = item.w as number;
        if (item.h !== undefined) h = item.h as number;
      } else if (typeof item === 'string') {
        const legend = item.split('\n');
        const at = /^(\d{1,2}),(\d{1,2})$/.exec(legend[0] ?? '');
        const encoder = legend[9] === 'e';
        if (at && !encoder) {
          const [row, col] = [Number(at[1]), Number(at[2])];
          if (row >= rows || col >= cols) return fail(`A key at ${row},${col} is outside the ${rows} by ${cols} matrix.`);
          const o = /^(\d{1,2}),(\d{1,2})$/.exec(legend[9] ?? '');
          const option = o ? { group: Number(o[1]), choice: Number(o[2]) } : undefined;
          if (option && (option.group >= opts.length || option.choice >= (opts[option.group]?.choices.length ?? 0))) return fail('A key refers to a layout option the definition does not list.');
          if (keys.length >= MAX_KEYS) return fail('The definition has too many keys.');
          keys.push({ row, col, x, y, w, h, r, rx, ry, ...(option ? { option } : {}) });
        }
        x += w;
        w = 1;
        h = 1;
      } else {
        return fail('The key layout is malformed.');
      }
    }
    y += 1;
  }
  if (keys.length === 0) return fail('The definition has no keys.');
  return { ok: true, definition: { name: typeof raw.name === 'string' ? raw.name.slice(0, 80) : 'Keyboard', ...id, rows, cols, keys, options: opts } };
}

/** The keys to draw: those outside any option, plus the chosen variant of each option. */
export const visibleKeys = (d: ViaDefinition, chosen: number[]): ViaKey[] =>
  d.keys.filter((k) => !k.option || (chosen[k.option.group] ?? 0) === k.option.choice);

/** The size of the drawing in key units, covering rotated keys. */
export function extent(keys: ViaKey[]): { w: number; h: number; minX: number; minY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const k of keys) {
    const a = (k.r * Math.PI) / 180;
    for (const [dx, dy] of [[0, 0], [k.w, 0], [0, k.h], [k.w, k.h]] as const) {
      // Rotate the corner (x + dx, y + dy) about (rx, ry).
      const px = k.x + dx - k.rx, py = k.y + dy - k.ry;
      const X = k.rx + px * Math.cos(a) - py * Math.sin(a), Y = k.ry + px * Math.sin(a) + py * Math.cos(a);
      minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y);
    }
  }
  return keys.length ? { w: maxX - minX, h: maxY - minY, minX, minY } : { w: 0, h: 0, minX: 0, minY: 0 };
}
