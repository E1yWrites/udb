// Protocol adapter for the `compx` family (Pulsar Bibimbap /cMouse). Pure
// encode/decode plus the command allowlist; I/O lives in the transport.
// Every fact here is documented, with its source, in docs/protocols/compx.md.

import type { OutgoingReport } from '../lib/transport.ts';

export const REPORT_ID = 8;
const LEN = 16;

export const CMD = {
  EncryptionData: 1,
  DeviceOnLine: 3,
  BatteryLevel: 4,
  WriteFlashData: 7,
  ReadFlashData: 8,
} as const;

export const ADDR = { pollingRate: 0x00, stageCount: 0x02, currentStage: 0x04 } as const;

/** Flash ranges UDB may write: [start, length]. Everything else is refused. */
const WRITABLE: readonly (readonly [number, number])[] = [
  [ADDR.pollingRate, 2],
  [ADDR.currentStage, 2],
];
const READABLE_END = 0x100;
const MAX_CHUNK = 10;

/** (0x55 − (report ID + bytes 0..14)) & 0xFF. */
export function checksum(b: Uint8Array): number {
  let sum = REPORT_ID;
  for (let i = 0; i < LEN - 1; i++) sum += b[i]!;
  return (0x55 - sum) & 0xff;
}

function frame(bytes: Record<number, number>): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(LEN);
  for (const [i, v] of Object.entries(bytes)) b[Number(i)] = v;
  b[LEN - 1] = checksum(b);
  return b;
}

const out = (data: Uint8Array<ArrayBuffer>): OutgoingReport => ({ type: 'output', reportId: REPORT_ID, data });

/** Identity handshake. The vendor driver sends 4 random bytes then 4 zeros; UDB does the same. */
export function encryptionData(random: [number, number, number, number]): OutgoingReport {
  return out(frame({ 0: CMD.EncryptionData, 4: 8, 5: random[0], 6: random[1], 7: random[2], 8: random[3] }));
}

export const deviceOnLine = () => out(frame({ 0: CMD.DeviceOnLine }));
export const batteryLevel = () => out(frame({ 0: CMD.BatteryLevel }));

export function readFlash(addr: number, len: number): OutgoingReport {
  return out(frame({ 0: CMD.ReadFlashData, 2: addr >> 8, 3: addr & 0xff, 4: len }));
}

export function writeFlash(addr: number, data: number[]): OutgoingReport {
  const fields: Record<number, number> = { 0: CMD.WriteFlashData, 2: addr >> 8, 3: addr & 0xff, 4: data.length };
  data.forEach((v, i) => (fields[5 + i] = v));
  return out(frame(fields));
}

/** The adapter allowlist the transport enforces. Exact bytes, not just command IDs. */
export function allow(r: OutgoingReport): boolean {
  const b = r.data;
  if (r.type !== 'output' || r.reportId !== REPORT_ID || b.length !== LEN || b[1] !== 0) return false;
  if (b[LEN - 1] !== checksum(b)) return false;
  const addr = (b[2]! << 8) | b[3]!;
  const len = b[4]!;
  const zeroFrom = (i: number) => b.subarray(i, LEN - 1).every((v) => v === 0);
  switch (b[0]) {
    case CMD.EncryptionData:
      return addr === 0 && len === 8 && zeroFrom(9);
    case CMD.DeviceOnLine: // only the plain query; the byte-5 variant's effect is unknown
    case CMD.BatteryLevel:
      return zeroFrom(2);
    case CMD.ReadFlashData:
      return len >= 1 && len <= MAX_CHUNK && addr + len <= READABLE_END && zeroFrom(5);
    case CMD.WriteFlashData:
      return WRITABLE.some(([start, n]) => addr === start && len === n) && zeroFrom(5 + len);
    default:
      return false;
  }
}

/** Is `res` (an input report 8 payload) the device's answer to `req`? Mirrors the vendor driver. */
export function isResponse(req: Uint8Array, res: Uint8Array): boolean {
  if (res.length < LEN || res[0] !== req[0]) return false;
  if (res[1] === 1) return true; // device: command not supported
  const compare = req[0] === CMD.ReadFlashData ? 5 : 3;
  for (let i = 1; i < compare; i++) if (res[i] !== req[i]) return false;
  return true;
}

export class CompxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompxError';
  }
}

function ok(res: Uint8Array, what: string): void {
  if (res[1] === 1) throw new CompxError(`${what}: device reports the command as not supported`);
  if (res[1] !== 0) throw new CompxError(`${what}: unexpected status ${res[1]}`);
}

export interface Info {
  cid: number;
  mid: number;
  type: number;
  wired: boolean;
  maxRate: number;
}

const TYPE_MAX_RATE: Record<number, { wired: boolean; maxRate: number }> = {
  0: { wired: false, maxRate: 1000 },
  1: { wired: false, maxRate: 4000 },
  2: { wired: true, maxRate: 1000 },
  3: { wired: true, maxRate: 8000 },
  4: { wired: false, maxRate: 2000 },
  5: { wired: false, maxRate: 8000 },
};

export function decodeInfo(res: Uint8Array): Info {
  ok(res, 'Identify');
  const type = res[11]!;
  const t = TYPE_MAX_RATE[type];
  if (!t) throw new CompxError(`Identify: unknown connection type ${type}`);
  return { cid: res[9]!, mid: res[10]!, type, ...t };
}

export function decodeOnline(res: Uint8Array): { online: boolean; busy: boolean } {
  ok(res, 'Online check');
  return { online: res[5] === 1, busy: res[9] === 1 };
}

export function decodeBattery(res: Uint8Array): { level: number; charging: boolean } {
  ok(res, 'Battery');
  return { level: res[5]!, charging: res[6] === 1 };
}

export function decodeFlash(req: Uint8Array, res: Uint8Array): Uint8Array {
  ok(res, 'Flash read');
  const len = req[4]!;
  if (res[4] !== len) throw new CompxError(`Flash read: asked for ${len} bytes, got ${res[4]}`);
  return res.slice(5, 5 + len);
}

export function decodeWrite(res: Uint8Array): void {
  ok(res, 'Flash write');
}

/** A one-byte setting stored next to its complement: [v, 0x55 − v]. Null if the pair is corrupt. */
export const encodePair = (v: number): number[] => [v & 0xff, (0x55 - v) & 0xff];
export const decodePair = (b: Uint8Array): number | null => (((b[0]! + b[1]!) & 0xff) === 0x55 ? b[0]! : null);

export const POLLING_RATES = [125, 250, 500, 1000, 2000, 4000, 8000] as const;

/** Hz → flash code: 1000/Hz up to 1 kHz, Hz/2000×16 above (the encoder the vendor app calls). */
export function rateToCode(hz: number): number {
  return hz <= 1000 ? 1000 / hz : (hz / 2000) * 16;
}

export function codeToRate(code: number): number | null {
  const hz = code >= 16 ? (code / 16) * 2000 : 1000 / code;
  return (POLLING_RATES as readonly number[]).includes(hz) ? hz : null;
}
