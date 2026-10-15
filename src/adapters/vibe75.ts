// Protocol adapter for the Mechlands Vibe75 (OEM family shared with the XVX
// G75). Facts and sources: docs/protocols/vibe75.md. Status: experimental.

import type { OutgoingReport } from '../lib/transport.ts';

export const REPORT_ID = 0;
export const PAYLOAD = 64;
export const PROFILES = [0, 1, 2, 3, 4] as const;

function feature(bytes: Record<number, number>): OutgoingReport {
  const data = new Uint8Array(PAYLOAD);
  for (const [i, v] of Object.entries(bytes)) data[Number(i)] = v;
  return { type: 'feature', reportId: REPORT_ID, data };
}

/** `04 12 <profile>`: read one profile's lighting block (read-only). */
export const readLighting = (profile: number) => feature({ 0: 0x04, 1: 0x12, 2: profile });

export interface LightingBlock {
  mode: number;
  color: [number, number, number];
  /** Bytes 8-11: profile, brightness and speed per the XVX G75 notes; byte 11 unknown. */
  profile: number;
  brightness: number;
  speed: number;
  byte11: number;
}

/** Decodes a `04 12` reply. Null when the profile holds no block (no `AA 55` at 14-15). */
export function decodeLighting(res: Uint8Array): LightingBlock | null {
  if (res.length < 16 || res[14] !== 0xaa || res[15] !== 0x55) return null;
  return {
    mode: res[0]!,
    color: [res[1]!, res[2]!, res[3]!],
    profile: res[8]!,
    brightness: res[9]!,
    speed: res[10]!,
    byte11: res[11]!,
  };
}

/** Vendor `layouts/rgb-keyboard.xml`: brightness_max 5, speed_max 5, cmd_delaytime 35 ms. */
export const BRIGHTNESS_MAX = 5;
export const SPEED_MAX = 5;
export const FRAME_DELAY_MS = 35;

/** The vendor's lighting write: begin, header, block, end, then 04 F0 (no ack). */
export const begin = () => feature({ 0: 0x04, 1: 0x18 });
export const lightingHeader = () => feature({ 0: 0x04, 1: 0x13, 8: 1 });
export const end = () => feature({ 0: 0x04, 1: 0x02 });
export const finish = () => feature({ 0: 0x04, 1: 0xf0 });

export function lightingBlock(l: LightingBlock): OutgoingReport {
  return feature({
    0: l.mode,
    1: l.color[0],
    2: l.color[1],
    3: l.color[2],
    8: l.profile,
    9: l.brightness,
    10: l.speed,
    11: l.byte11,
    14: 0xaa,
    15: 0x55,
  });
}

/** Read reply states: the block itself, still pending (status 01), or no block (status FF). */
export function replyState(res: Uint8Array, profile: number): 'block' | 'pending' | 'empty' | 'unknown' {
  if (decodeLighting(res)) return 'block';
  if (res[0] === 0x04 && res[1] === 0x12 && res[2] === profile) return res[3] === 0x01 ? 'pending' : res[3] === 0xff ? 'empty' : 'unknown';
  return 'unknown';
}

const zeroFrom = (b: Uint8Array, i: number) => b.subarray(i).every((v) => v === 0);
const zeroRange = (b: Uint8Array, from: number, to: number) => b.subarray(from, to).every((v) => v === 0);

/**
 * Allowlist: the lighting read, the five frames of the vendor's lighting
 * write, and GET_FEATURE. INIT (01), key, macro, LCD and system-settings
 * traffic are refused.
 */
export function allow(r: OutgoingReport): boolean {
  if (r.reportId !== REPORT_ID) return false;
  if (r.type === 'feature-read') return true;
  const b = r.data;
  if (r.type !== 'feature' || b.length !== PAYLOAD) return false;
  if (b[0] === 0x04 && b[1] === 0x12) return b[2]! <= 4 && zeroFrom(b, 3);
  if (b[0] === 0x04 && (b[1] === 0x18 || b[1] === 0x02 || b[1] === 0xf0) && zeroFrom(b, 2)) return true;
  if (b[0] === 0x04 && b[1] === 0x13) return zeroRange(b, 2, 8) && b[8] === 1 && zeroFrom(b, 9);
  // Lighting block: signature, zero gaps, fields within the vendor's ranges.
  return (
    b[14] === 0xaa &&
    b[15] === 0x55 &&
    zeroRange(b, 4, 8) &&
    zeroRange(b, 12, 14) &&
    zeroFrom(b, 16) &&
    b[8]! <= 4 &&
    b[9]! <= BRIGHTNESS_MAX &&
    b[10]! <= SPEED_MAX
  );
}
