// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Protocol adapter for Razer's 90-byte control reports. Facts and sources:
// docs/protocols/razer.md. The packet layout, checksum, status codes, command
// table and decoders are ported from OpenMouse mouse-protocol
// (src/razer/codec.ts; https://github.com/OpenMouse-Project/mouse-protocol,
// commit e53af6d5, AGPL-3.0-or-later). See ADR 8.
// UDB changes: an exact-shape allowlist over the commands below only (no
// serial, stage-table, lift-off, button or lighting commands). Status: experimental.

import type { OutgoingReport } from '../lib/transport.ts';

export const REPORT_ID = 0;
export const LENGTH = 90;
const ARGS = 8;
const CRC = 88;

export const STATUS = { busy: 0x01, ok: 0x02, failure: 0x03, timeout: 0x04, unsupported: 0x05 } as const;
export const TRANSACTION_IDS = [0x1f, 0x3f, 0xff] as const;

export interface Command {
  cls: number;
  id: number;
  size: number;
  args?: number[];
}

export const READ = {
  firmware: { cls: 0x00, id: 0x81, size: 2 },
  battery: { cls: 0x07, id: 0x80, size: 2 },
  charging: { cls: 0x07, id: 0x84, size: 2 },
  sleep: { cls: 0x07, id: 0x83, size: 2 },
  lowPower: { cls: 0x07, id: 0x81, size: 2 },
  polling: { cls: 0x00, id: 0x85, size: 1 },
  pollingExtended: { cls: 0x00, id: 0xc0, size: 2, args: [0x00] },
} as const satisfies Record<string, Command>;

export const readDpi = (storage: number): Command => ({ cls: 0x04, id: 0x85, size: 7, args: [storage] });
export const setDpi = (storage: number, dpi: number): Command => ({
  cls: 0x04,
  id: 0x05,
  size: 7,
  args: [storage, dpi >> 8, dpi & 0xff, dpi >> 8, dpi & 0xff, 0, 0],
});
export const setSleep = (seconds: number): Command => ({ cls: 0x07, id: 0x03, size: 2, args: [seconds >> 8, seconds & 0xff] });
export const setLowPower = (percent: number): Command => ({ cls: 0x07, id: 0x01, size: 2, args: [encodeLevel(percent), 0] });
export const setPolling = (hz: number): Command => ({ cls: 0x00, id: 0x05, size: 1, args: [1000 / hz] });
/** Selector 0 is the write; selector 1 is the commit some products need. */
export const setPollingExtended = (hz: number, selector: 0 | 1 = 0): Command => ({ cls: 0x00, id: 0x40, size: 2, args: [selector, 8000 / hz] });

export const LEGACY_RATES = [125, 500, 1000] as const;
export const EXTENDED_RATES = [125, 500, 1000, 2000, 4000, 8000] as const;
export const SLEEP = { min: 60, max: 900, step: 60 } as const;
export const DPI_MIN = 100;

export const checksum = (p: Uint8Array) => p.subarray(2, CRC).reduce((x, b) => x ^ b, 0);

export function encode(c: Command, transactionId: number): OutgoingReport {
  const data = new Uint8Array(LENGTH);
  data[1] = transactionId;
  data[5] = c.size;
  data[6] = c.cls;
  data[7] = c.id;
  data.set(c.args ?? [], ARGS);
  data[CRC] = checksum(data);
  return { type: 'feature', reportId: REPORT_ID, data };
}

export class RazerError extends Error {
  readonly status: number | null;
  /** The reply names another command: a stale answer to an earlier request. */
  readonly stale: boolean;
  constructor(message: string, status: number | null = null, stale = false) {
    super(message);
    this.name = 'RazerError';
    this.status = status;
    this.stale = stale;
  }
}

const name = (c: Command) => `Command ${c.cls.toString(16).padStart(2, '0')}/${c.id.toString(16).padStart(2, '0')}`;

/** The reply's arguments, or a RazerError naming the status. */
export function decode(packet: Uint8Array, c: Command): Uint8Array {
  if (packet.length !== LENGTH) throw new RazerError(`${name(c)} returned ${packet.length} bytes instead of ${LENGTH}`);
  if (packet[CRC] !== checksum(packet)) throw new RazerError(`${name(c)} returned a reply with a bad checksum`);
  const status = packet[0]!;
  if (status === STATUS.unsupported) throw new RazerError(`${name(c)} is not supported by this mouse`, status);
  if (status !== STATUS.ok) throw new RazerError(`${name(c)} returned status ${status.toString(16).padStart(2, '0')}`, status);
  if (packet[6] !== c.cls || packet[7] !== c.id) throw new RazerError(`${name(c)} was answered by another command`, status, true);
  return packet.slice(ARGS, ARGS + Math.min(packet[5]!, CRC - ARGS));
}

export const isGet = (c: Command) => (c.id & 0x80) !== 0;

const SCALE = 255;
export const encodeLevel = (percent: number) => Math.round((percent * SCALE) / 100);
export const decodeFirmware = (a: Uint8Array) => `${a[0]}.${a[1]}`;
export const decodeBattery = (a: Uint8Array) => Math.round((a[1]! * 100) / SCALE);
export const decodeCharging = (a: Uint8Array) => a[1] === 1;
export const decodeSleep = (a: Uint8Array) => (a[0]! << 8) | a[1]!;
/** The threshold's level sits in the first byte, unlike battery's (OpenMouse, from a Synapse comparison). */
export const decodeLowPower = (a: Uint8Array) => Math.round((a[0]! * 100) / SCALE);
export const decodeDpi = (a: Uint8Array) => ({ x: (a[1]! << 8) | a[2]!, y: (a[3]! << 8) | a[4]! });
export const decodePolling = (a: Uint8Array) => (a[0] ? Math.round(1000 / a[0]) : null);
export const decodePollingExtended = (a: Uint8Array) => (a[1] ? Math.round(8000 / a[1]) : null);

/**
 * Allowlist: the commands above with exact sizes and in-range arguments, on a
 * known transaction ID, with a valid checksum and zero padding. Reading the
 * reply (GET_FEATURE on report 0) is always allowed.
 */
export function allow(r: OutgoingReport): boolean {
  if (r.reportId !== REPORT_ID) return false;
  if (r.type === 'feature-read') return true;
  const b = r.data;
  if (r.type !== 'feature' || b.length !== LENGTH) return false;
  if (b[0] !== 0 || b[2] !== 0 || b[3] !== 0 || b[4] !== 0 || b[89] !== 0) return false;
  if (!(TRANSACTION_IDS as readonly number[]).includes(b[1]!) || b[CRC] !== checksum(b)) return false;
  const [size, cls, id] = [b[5]!, b[6]!, b[7]!];
  const a = b.subarray(ARGS, CRC);
  const only = (n: number) => a.subarray(n).every((x) => x === 0);
  const is = (c: Command) => c.cls === cls && c.id === id && c.size === size;
  const u16 = (i: number) => (a[i]! << 8) | a[i + 1]!;
  if (Object.values(READ).some(is)) return only(0);
  if (cls === 0x04 && id === 0x85 && size === 7) return a[0]! <= 1 && only(1);
  if (cls === 0x04 && id === 0x05 && size === 7) {
    return a[0]! <= 1 && u16(1) >= DPI_MIN && u16(3) >= DPI_MIN && only(5);
  }
  if (cls === 0x07 && id === 0x03 && size === 2) return u16(0) >= SLEEP.min && u16(0) <= SLEEP.max && only(2);
  if (cls === 0x07 && id === 0x01 && size === 2) return only(1);
  if (cls === 0x00 && id === 0x05 && size === 1) return [1, 2, 8].includes(a[0]!) && only(1);
  if (cls === 0x00 && id === 0x40 && size === 2) return a[0]! <= 1 && [1, 2, 4, 8, 16, 64].includes(a[1]!) && only(2);
  return false;
}
