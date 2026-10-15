// SPDX-License-Identifier: AGPL-3.0-or-later
//
// DPI stage encodings for the compx platform (Pulsar, ATK, VXE).
// Ported from OpenMouse mouse-protocol src/atk/index.ts
// (https://github.com/OpenMouse-Project/mouse-protocol, commit c3b1bc20,
// AGPL-3.0-or-later; limits transcribed there from ATK HUB 3.2.27). See ADR 8.
// UDB changes: the PAW3955 Master six-byte rows are left out (unsupported in
// UDB for now), and Pulsar's "pulsar x1" sensor is added: Pulsar's own
// sensor.json ranges (10..10000/10, 10050..30000/50, 30100..32000/100 with
// DPIex 0/0x22/0x33) are the "ultra" family.

const CHECKSUM_TOTAL = 0x55;

export type DpiFamily = 'ultra' | 'step50' | 'stepped' | 'paw3395se';

export interface DpiSensor {
  family: DpiFamily;
  minDpi: number;
  maxDpi: number;
  /** Per-axis increments for the "stepped" family (valid DPI = min + k·step). */
  xStep?: number;
  yStep?: number;
}

export const DPI_SENSORS: Record<string, DpiSensor> = {
  PAW3950Ultra: { family: 'ultra', minDpi: 10, maxDpi: 42000 },
  PAW3950: { family: 'step50', minDpi: 50, maxDpi: 36000 },
  PAW3950DM: { family: 'step50', minDpi: 50, maxDpi: 36000 },
  PAW3395Ultra: { family: 'step50', minDpi: 100, maxDpi: 30000 },
  PAW3395: { family: 'step50', minDpi: 100, maxDpi: 30000 },
  PAW3395SE: { family: 'paw3395se', minDpi: 200, maxDpi: 18000 },
  PAW3315: { family: 'stepped', minDpi: 200, maxDpi: 16000, xStep: 100, yStep: 100 },
  PAW3311: { family: 'stepped', minDpi: 200, maxDpi: 15000, xStep: 100, yStep: 100 },
  PAW3320: { family: 'stepped', minDpi: 200, maxDpi: 4000, xStep: 39, yStep: 38 },
  CORE26K: { family: 'step50', minDpi: 50, maxDpi: 26000 },
  'pulsar x1': { family: 'ultra', minDpi: 10, maxDpi: 32000 },
};

type Axis = { byte: number; nibble: number };

/** Nibble bits 2-3 extend the byte, bit 1 selects the 50-DPI range above 10,000, bit 0 doubles above 30,000. */
function encodeUltra(dpi: number): Axis {
  let value = dpi;
  let doubled = 0;
  if (value > 30000) {
    doubled = 1;
    value = Math.round(value / 2);
  }
  if (value <= 10000) {
    const code = Math.floor(value / 10) - 1;
    return { byte: code & 0xff, nibble: ((code >> 8) << 2) | doubled };
  }
  const code = Math.floor((value - 10050) / 50);
  return { byte: code & 0xff, nibble: ((code >> 8) << 2) | 2 | doubled };
}

function decodeUltra(byte: number, nibble: number): number {
  const code = (((nibble >> 2) & 0x03) << 8) | (byte & 0xff);
  const base = (nibble & 2) !== 0 ? 10050 + code * 50 : (code + 1) * 10;
  return (nibble & 1) !== 0 ? base * 2 : base;
}

function encodeStep50(dpi: number): Axis {
  const doubled = dpi > 30000;
  const count = Math.round(dpi / (doubled ? 100 : 50)) - 1;
  return { byte: count & 0xff, nibble: (((count >> 8) & 0x03) << 2) | (doubled ? 1 : 0) };
}

function decodeStep50(byte: number, nibble: number): number {
  const count = (byte & 0xff) | (((nibble >> 2) & 0x03) << 8);
  const dpi = (count + 1) * 50;
  return (nibble & 1) !== 0 ? dpi * 2 : dpi;
}

const encodeStepped = (dpi: number, min: number, step: number): Axis => {
  const count = Math.round((dpi - min) / step);
  return { byte: count & 0xff, nibble: ((count >> 8) & 0x03) << 2 };
};

const decodeStepped = (byte: number, nibble: number, min: number, step: number): number =>
  min + ((byte & 0xff) | (((nibble >> 2) & 0x03) << 8)) * step;

const PAW3395SE_INVALID = new Set([
  7, 13, 20, 26, 33, 40, 46, 53, 60, 66, 73, 80, 86, 93, 100, 106, 113, 120, 126, 133, 140, 146, 153, 160, 166, 173, 180,
  186, 193, 200, 206, 213, 220, 226, 233,
]);
const PAW3395SE_CODES = Array.from({ length: 235 }, (_, i) => i + 1).filter((c) => !PAW3395SE_INVALID.has(c));

function encodePaw3395Se(dpi: number): Axis | null {
  const doubled = dpi > 10000;
  const base = doubled ? dpi / 2 : dpi;
  if (!Number.isInteger(base) || base < 50 || base > 10000 || base % 50 !== 0) return null;
  const code = PAW3395SE_CODES[base / 50 - 1];
  return code === undefined ? null : { byte: code, nibble: doubled ? 2 : 0 };
}

function decodePaw3395Se(byte: number, nibble: number): number | null {
  if ((nibble & ~2) !== 0) return null;
  const index = PAW3395SE_CODES.indexOf(byte & 0xff);
  if (index < 0) return null;
  const base = (index + 1) * 50;
  if ((nibble & 2) !== 0) return base > 5000 ? base * 2 : null;
  return base;
}

/** Every DPI value the sensor accepts (ATK HUB's option lists). */
export function dpiOptions(sensor: DpiSensor): number[] {
  const out: number[] = [];
  const push = (from: number, to: number, step: number) => {
    for (let d = from; d <= to; d += step) out.push(d);
  };
  switch (sensor.family) {
    case 'ultra':
      push(sensor.minDpi, Math.min(10000, sensor.maxDpi), 10);
      push(10050, Math.min(30000, sensor.maxDpi), 50);
      push(30100, sensor.maxDpi, 100);
      break;
    case 'paw3395se':
      push(sensor.minDpi, 10000, 50);
      push(10100, sensor.maxDpi, 100);
      break;
    case 'stepped':
      push(sensor.minDpi, sensor.maxDpi, sensor.xStep ?? 1);
      break;
    case 'step50':
      push(sensor.minDpi, Math.min(sensor.maxDpi, 30000), 50);
      push(30100, sensor.maxDpi, 100);
  }
  return out;
}

function axisValid(sensor: DpiSensor, dpi: number, step?: number): boolean {
  if (sensor.family === 'stepped') {
    return Number.isInteger(dpi) && dpi >= sensor.minDpi && dpi <= sensor.maxDpi && (dpi - sensor.minDpi) % (step ?? 1) === 0;
  }
  return dpiOptions(sensor).includes(dpi);
}

/** One DPI stage row: [x, y, packed nibbles, checksum]. Null when a value isn't valid for the sensor. */
export function packDpiStage(sensor: DpiSensor, x: number, y: number): number[] | null {
  const yStep = sensor.yStep ?? sensor.xStep;
  if (!axisValid(sensor, x, sensor.xStep) || !axisValid(sensor, y, yStep)) return null;
  let ex: Axis | null;
  let ey: Axis | null;
  if (sensor.family === 'stepped') {
    ex = encodeStepped(x, sensor.minDpi, sensor.xStep ?? 1);
    ey = encodeStepped(y, sensor.minDpi, yStep ?? 1);
  } else {
    const encode = sensor.family === 'paw3395se' ? encodePaw3395Se : sensor.family === 'step50' ? encodeStep50 : encodeUltra;
    ex = encode(x);
    ey = encode(y);
  }
  if (!ex || !ey) return null;
  const mode = ((ey.nibble & 0x0f) << 4) | (ex.nibble & 0x0f);
  return [ex.byte, ey.byte, mode, (CHECKSUM_TOTAL - ((ex.byte + ey.byte + mode) & 0xff)) & 0xff];
}

/** Decodes a stage row. Null when the row checksum fails or the code is invalid for the sensor. */
export function unpackDpiStage(sensor: DpiSensor, row: ArrayLike<number>): { x: number; y: number } | null {
  if (row.length < 4 || (row[0]! + row[1]! + row[2]! + row[3]!) % 0x100 !== CHECKSUM_TOTAL) return null;
  const nx = row[2]! & 0x0f;
  const ny = (row[2]! >> 4) & 0x0f;
  if (sensor.family === 'stepped') {
    return {
      x: decodeStepped(row[0]!, nx, sensor.minDpi, sensor.xStep ?? 1),
      y: decodeStepped(row[1]!, ny, sensor.minDpi, sensor.yStep ?? sensor.xStep ?? 1),
    };
  }
  const decode = sensor.family === 'paw3395se' ? decodePaw3395Se : sensor.family === 'step50' ? decodeStep50 : decodeUltra;
  const x = decode(row[0]!, nx);
  const y = decode(row[1]!, ny);
  return x === null || y === null ? null : { x, y };
}
