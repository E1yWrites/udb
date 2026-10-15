// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Protocol adapter for Logitech HID++ 2.0. Facts and sources:
// docs/protocols/logitech-hidpp.md. The error tables, battery and DPI-list
// decoders, report-rate decoding, receiver PIDs and device-index order are
// ported from OpenMouse mouse-protocol (src/logitech/index.ts,
// src/drivers/logitech/hidpp.ts and vendors.ts;
// https://github.com/OpenMouse-Project/mouse-protocol, commit e53af6d5,
// AGPL-3.0-or-later). See ADR 8.
// UDB changes: one allowlist keyed by the feature indices the device itself
// reported; long reports whenever a long collection is granted; a DPI of 0
// reads as the default (Solaar); no onboard-mode switching or profile writes.
// Status: experimental.

import type { OutgoingReport } from '../lib/transport.ts';

export const SHORT = 0x10;
export const LONG = 0x11;
/** Report sizes after the report ID: device index, feature index, function|sw, params. */
export const SIZE = { [SHORT]: 6, [LONG]: 19 } as const;
/** UDB's software ID. 0 is reserved for notifications from the device. */
export const SW_ID = 0x0a;
export const DIRECT = 0xff;

export const FEATURE = {
  root: 0x0000,
  deviceInfo: 0x0003,
  deviceName: 0x0005,
  batteryLevel: 0x1000,
  batteryVoltage: 0x1001,
  unifiedBattery: 0x1004,
  dpi: 0x2201,
  extendedDpi: 0x2202,
  reportRate: 0x8060,
  extendedReportRate: 0x8061,
  onboardProfiles: 0x8100,
} as const;

/** The functions UDB may call on each feature (docs/protocols/logitech-hidpp.md). */
const FUNCTIONS: Record<number, number[]> = {
  [FEATURE.root]: [0, 1],
  [FEATURE.deviceInfo]: [0],
  [FEATURE.deviceName]: [0, 1],
  [FEATURE.batteryLevel]: [0],
  [FEATURE.batteryVoltage]: [0],
  [FEATURE.unifiedBattery]: [1],
  [FEATURE.dpi]: [1, 2, 3],
  [FEATURE.extendedDpi]: [1, 2, 5, 6],
  [FEATURE.reportRate]: [0, 1, 2],
  [FEATURE.extendedReportRate]: [0, 1, 2, 3],
  [FEATURE.onboardProfiles]: [2],
};

/** Receivers: probed on pairing slots first (OpenMouse vendors.ts, from Solaar's receiver list and user diagnostics). */
export const RECEIVER_PIDS: readonly number[] = [
  0xc54d, 0xc543, 0xc539, 0xc0a8, 0xc547, 0x40bd, 0xc54f, 0xc52b, 0xc532,
  0xc53a, 0xc53d, 0xc53f, 0xc541, 0xc545,
  0xc518, 0xc51a, 0xc51b, 0xc521, 0xc525, 0xc526, 0xc52e, 0xc52f, 0xc531, 0xc534, 0xc537,
  0xc548,
];

/** Device indices to probe: pairing slots before the receiver itself, or the device itself first. */
export const indexCandidates = (receiver: boolean): number[] =>
  receiver ? [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, DIRECT] : [DIRECT, 0x01];

export const REPORT_RATES = [125, 250, 500, 1000, 2000, 4000, 8000] as const;

export function frame(reportId: typeof SHORT | typeof LONG, deviceIndex: number, featureIndex: number, fn: number, params: number[] = []): OutgoingReport {
  if (params.length > SIZE[reportId] - 3) throw new Error(`HID++ ${reportId === LONG ? 'long' : 'short'} reports carry at most ${SIZE[reportId] - 3} parameters`);
  const data = new Uint8Array(SIZE[reportId]);
  data.set([deviceIndex, featureIndex, (fn << 4) | SW_ID, ...params]);
  return { type: 'output', reportId, data };
}

/** A reply to `req`: the same device, feature index and function|sw, or an error naming them. */
export function isReply(req: Uint8Array, res: Uint8Array): boolean {
  if (res.length < 4 || res[0] !== req[0]) return false;
  if (res[1] === req[1] && res[2] === req[2]) return true;
  return (res[1] === 0xff || res[1] === 0x8f) && res[2] === req[1] && res[3] === req[2];
}

const HIDPP20_ERRORS: Record<number, string> = {
  0x01: 'unknown request',
  0x02: 'invalid argument',
  0x03: 'value out of range',
  0x04: 'hardware error',
  0x05: 'Logitech internal error',
  0x06: 'invalid feature index',
  0x07: 'invalid function',
  0x08: 'device busy',
  0x09: 'unsupported',
};

const HIDPP10_ERRORS: Record<number, string> = {
  0x01: 'invalid command',
  0x02: 'invalid address',
  0x03: 'invalid value',
  0x04: 'connection request failed',
  0x05: 'too many devices',
  0x06: 'already exists',
  0x07: 'device busy',
  0x08: 'unknown device',
  0x09: 'resource error',
  0x0a: 'request unavailable',
  0x0b: 'unsupported parameter value',
  0x0c: 'wrong PIN code',
};

export class HidppError extends Error {
  readonly version: 1 | 2;
  readonly code: number;
  constructor(version: 1 | 2, code: number) {
    const reason = (version === 2 ? HIDPP20_ERRORS : HIDPP10_ERRORS)[code] ?? `error 0x${code.toString(16).padStart(2, '0')}`;
    super(`The device refused the request (HID++ ${version}.0: ${reason})`);
    this.name = 'HidppError';
    this.version = version;
    this.code = code;
  }
}

/** The error a reply carries, or null for a normal reply. */
export function errorOf(res: Uint8Array): HidppError | null {
  if (res[1] === 0xff) return new HidppError(2, res[4] ?? 0);
  if (res[1] === 0x8f) return new HidppError(1, res[4] ?? 0);
  return null;
}

const u16 = (res: Uint8Array, i: number) => ((res[i] ?? 0) << 8) | (res[i + 1] ?? 0);

/** Root getFeature: the feature's index on this device, 0 when absent. */
export const decodeFeatureIndex = (res: Uint8Array) => res[3] ?? 0;

export function decodeProtocolVersion(res: Uint8Array): { major: number; minor: number } {
  return { major: res[3] ?? 0, minor: res[4] ?? 0 };
}

export interface DeviceInfo {
  /** PIDs per transport, in the order the flags list them. */
  bluetoothPid: number | null;
  blePid: number | null;
  wirelessPid: number | null;
  usbPid: number | null;
}

/** 0x0003 getDeviceInfo: transport flags at byte 9, up to three 2-byte PIDs at 10-15. */
export function decodeDeviceInfo(res: Uint8Array): DeviceInfo {
  const info: DeviceInfo = { bluetoothPid: null, blePid: null, wirelessPid: null, usbPid: null };
  if (res.length < 16) return info;
  const flags = res[9]!;
  let at = 10;
  for (const [key, bit] of [['bluetoothPid', 0x01], ['blePid', 0x02], ['wirelessPid', 0x04], ['usbPid', 0x08]] as const) {
    if (!(flags & bit) || at > 14) continue;
    info[key] = u16(res, at);
    at += 2;
  }
  return info;
}

/** 0x0005 getName: up to 16 characters per long reply (fewer on a short one). */
export const decodeNameChunk = (res: Uint8Array, remaining: number) =>
  Array.from(res.subarray(3, 3 + Math.min(remaining, res.length - 3)));

export type ChargeState = 'discharging' | 'charging' | 'charging slowly' | 'almost full' | 'full' | 'unknown';

export interface Battery {
  percent: number | null;
  state: ChargeState;
  millivolts?: number;
}

/** 0x1004 getStatus. Its charging codes differ from 0x1000's. */
export function decodeUnifiedBattery(res: Uint8Array): Battery {
  const percent = res[3] ?? 0xff;
  const states: Record<number, ChargeState> = { 0: 'discharging', 1: 'charging', 2: 'charging slowly', 3: 'full' };
  return { percent: percent <= 100 ? percent : null, state: states[res[5] ?? -1] ?? 'unknown' };
}

/** 0x1000 getBatteryLevelStatus. */
export function decodeBatteryLevel(res: Uint8Array): Battery {
  const percent = res[3] ?? 0xff;
  const states: Record<number, ChargeState> = { 0: 'discharging', 1: 'charging', 2: 'almost full', 3: 'full', 4: 'charging slowly' };
  return { percent: percent <= 100 ? percent : null, state: states[res[5] ?? -1] ?? 'unknown' };
}

const VOLTAGE_CURVE = [
  [4186, 100], [4067, 90], [3989, 80], [3922, 70], [3859, 60],
  [3811, 50], [3778, 40], [3751, 30], [3717, 20], [3671, 10],
  [3646, 5], [3579, 2], [3500, 0],
] as const;

/** Rough charge from a Li-ion voltage (OpenMouse's curve). */
export function estimatePercent(mv: number): number {
  if (mv >= VOLTAGE_CURVE[0][0]) return 100;
  if (mv <= VOLTAGE_CURVE[VOLTAGE_CURVE.length - 1]![0]) return 0;
  for (let i = 0; i < VOLTAGE_CURVE.length - 1; i++) {
    const [hiMv, hiPct] = VOLTAGE_CURVE[i]!;
    const [loMv, loPct] = VOLTAGE_CURVE[i + 1]!;
    if (mv <= hiMv && mv >= loMv) return Math.round(loPct + ((mv - loMv) * (hiPct - loPct)) / (hiMv - loMv));
  }
  return 0;
}

/** 0x1001 getBatteryInfo: millivolts and flags (bit 7 charging, bit 4 slow, low bits 2 = full). */
export function decodeBatteryVoltage(res: Uint8Array): Battery {
  const millivolts = u16(res, 3);
  const flags = res[5] ?? 0;
  const charging = (flags & 0x80) !== 0;
  const state: ChargeState = charging && (flags & 0x03) === 0x02 ? 'full' : flags & 0x10 ? 'charging slowly' : charging ? 'charging' : 'discharging';
  return { percent: millivolts ? estimatePercent(millivolts) : null, state, millivolts };
}

/**
 * A DPI list: big-endian uint16 values, where `0xE000 | step` marks a range
 * from the previous value to the next one. Ends at 0. Null when malformed.
 */
export function decodeDpiList(bytes: number[]): number[] | null {
  const out: number[] = [];
  for (let i = 0; i + 1 < bytes.length; ) {
    const value = (bytes[i]! << 8) | bytes[i + 1]!;
    if (value === 0) break;
    if (value >> 13 === 0b111) {
      const step = value & 0x1fff;
      const last = ((bytes[i + 2] ?? 0) << 8) | (bytes[i + 3] ?? 0);
      const first = out[out.length - 1];
      if (!first || !step || !last || last <= first) return null;
      for (let dpi = first + step; dpi <= last; dpi += step) out.push(dpi);
      i += 4;
    } else {
      out.push(value);
      i += 2;
    }
  }
  return out;
}

/** 0x2201 getSensorDpi: [sensor, dpi, default]. Some mice report 0, meaning the default (Solaar). */
export function decodeLegacyDpi(res: Uint8Array): number | null {
  const dpi = u16(res, 4) || u16(res, 6);
  return dpi || null;
}

export interface DpiParameters {
  x: number;
  y: number;
  lod: number;
}

/** 0x2202 getSensorDpiParameters: [sensor, x, defaultX, y, defaultY, lod]. */
export function decodeDpiParameters(res: Uint8Array): DpiParameters | null {
  if (res.length < 13) return null;
  const x = u16(res, 4);
  const y = u16(res, 8);
  return x && y ? { x, y, lod: res[12]! } : null;
}

/** 0x8060 list: bit i marks an interval of (i + 1) ms. The G402 reports 0x8B = 1, 2, 4, 8 ms. */
export function decodeReportRateBitmap(bitmap: number): number[] {
  const rates: number[] = [];
  for (let bit = 0; bit < 8; bit++) if (bitmap & (1 << bit)) rates.push(Math.round(1000 / (bit + 1)));
  return rates.sort((a, b) => a - b);
}

/** 0x8060 getReportRate: the interval in ms. */
export const decodeLegacyRate = (res: Uint8Array): number | null => {
  const ms = res[3] ?? 0;
  return ms >= 1 && ms <= 8 ? Math.round(1000 / ms) : null;
};

/** 0x8061 list: bit n of the big-endian mask is rate code n. */
export const decodeRateMask = (res: Uint8Array): number[] => REPORT_RATES.filter((_, n) => u16(res, 3) & (1 << n));

/** 0x8061 getReportRate: a rate code 0-6. */
export const decodeRateCode = (res: Uint8Array): number | null => REPORT_RATES[res[3] ?? -1] ?? null;

export const decodeOnboardMode = (res: Uint8Array): 'onboard' | 'host' | null => (res[3] === 1 ? 'onboard' : res[3] === 2 ? 'host' : null);

/**
 * The allowlist, keyed by the feature indices the device reported (feature
 * ID → index). Only the functions in the protocol doc, with parameters in
 * shape, on device indices 01-06 or FF, with UDB's software ID. HID++ 1.0
 * register commands, DFU, reset, host change, hidden features, button and
 * lighting features, and every onboard-profile write are refused.
 */
export function allowFor(features: ReadonlyMap<number, number>): (r: OutgoingReport) => boolean {
  return (r) => {
    const b = r.data;
    if (r.type !== 'output' || (r.reportId !== SHORT && r.reportId !== LONG) || b.length !== SIZE[r.reportId]) return false;
    const [dev, index, fnsw] = [b[0]!, b[1]!, b[2]!];
    if (!(dev === DIRECT || (dev >= 1 && dev <= 6)) || (fnsw & 0x0f) !== SW_ID) return false;
    const id = index === 0 ? FEATURE.root : [...features].find(([fid, i]) => i === index && fid !== FEATURE.root)?.[0];
    const fn = fnsw >> 4;
    if (id === undefined || !FUNCTIONS[id]?.includes(fn)) return false;
    const p = b.subarray(3);
    const zeroFrom = (i: number) => p.subarray(i).every((x) => x === 0);
    const dpi = (i: number) => {
      const v = (p[i]! << 8) | p[i + 1]!;
      return v >= 1 && v >> 13 !== 0b111;
    };
    switch (id) {
      case FEATURE.root:
        return fn === 0 ? zeroFrom(2) : p[0] === 0 && p[1] === 0 && zeroFrom(3);
      case FEATURE.deviceName:
        return fn === 0 ? zeroFrom(0) : zeroFrom(1);
      case FEATURE.dpi:
        return p[0] === 0 && (fn === 3 ? dpi(1) && zeroFrom(3) : zeroFrom(1));
      case FEATURE.extendedDpi:
        if (p[0] !== 0) return false;
        if (fn === 2) return p[1] === 0 && p[2]! < 32 && zeroFrom(3);
        if (fn === 6) return dpi(1) && dpi(3) && p[5]! <= 3 && zeroFrom(6);
        return zeroFrom(1);
      case FEATURE.reportRate:
        return fn === 2 ? p[0]! >= 1 && p[0]! <= 8 && zeroFrom(1) : zeroFrom(0);
      case FEATURE.extendedReportRate:
        return (fn === 3 ? p[0]! <= 6 : p[0]! <= 1) && zeroFrom(1);
      default:
        return zeroFrom(0);
    }
  };
}
