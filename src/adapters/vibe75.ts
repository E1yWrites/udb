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

/** Allowlist. This release only reads; write frames are added once a real block has been seen. */
export function allow(r: OutgoingReport): boolean {
  if (r.reportId !== REPORT_ID) return false;
  if (r.type === 'feature-read') return true;
  const b = r.data;
  if (r.type !== 'feature' || b.length !== PAYLOAD) return false;
  return b[0] === 0x04 && b[1] === 0x12 && b[2]! <= 4 && b.subarray(3).every((v) => v === 0);
}
