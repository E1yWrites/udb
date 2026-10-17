// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Protocol adapter for Corsair's classic ("NXP") mouse protocol, as on the
// NIGHTSWORD RGB. Facts and sources: docs/protocols/corsair.md. Packet layout,
// commands and decoders are ported from OpenMouse mouse-protocol
// (src/corsair/index.ts; https://github.com/OpenMouse-Project/mouse-protocol,
// commit e53af6d5, AGPL-3.0-or-later; protocol origin ckb-next, with two
// corrections OpenMouse found on hardware). See ADR 8.
// UDB changes: an exact-shape allowlist; the stage mask, polling, profile and
// hardware-profile writes are refused. Status: experimental.

import type { OutgoingReport } from '../lib/transport.ts';

export const REPORT_ID = 0;
export const SIZE = 64;
export const GET = 0x0e;
export const SET = 0x07;
export const FIELD = { ident: 0x01, mouse: 0x13 } as const;
export const MOUSE = { dpi: 0x02, lift: 0x03, snap: 0x04, mask: 0x05, stage: 0xd0 } as const;
/** Byte 3: 0 = live settings (volatile), 1 = stored profile (reads zeros on fw 3.41). */
export const LIVE = 0;
export const STAGES = 6;
export const LIFT = { min: 1, max: 5 } as const;
/** Allowlist bounds for DPI; each model's own range is checked by the setting. */
export const DPI_BOUNDS = { min: 100, max: 26_000 } as const;

function packet(...bytes: number[]): OutgoingReport {
  const data = new Uint8Array(SIZE);
  data.set(bytes);
  return { type: 'feature', reportId: REPORT_ID, data };
}

export const ident = () => packet(GET, FIELD.ident, 0);
export const getMouse = (sub: number) => packet(GET, FIELD.mouse, sub, LIVE);
export const getStage = (stage: number) => getMouse(MOUSE.stage | stage);
export const setActiveStage = (stage: number) => packet(SET, FIELD.mouse, MOUSE.dpi, LIVE, stage);
export const setLift = (height: number) => packet(SET, FIELD.mouse, MOUSE.lift, LIVE, height);
export const setSnap = (on: boolean) => packet(SET, FIELD.mouse, MOUSE.snap, LIVE, on ? 1 : 0);
/** SET takes DPI little-endian (GET answers big-endian), and the stage colour must be written back or it is cleared. */
export const setStageDpi = (stage: number, dpi: number, rgb: [number, number, number]) =>
  packet(SET, FIELD.mouse, MOUSE.stage | stage, LIVE, 0, dpi & 0xff, dpi >> 8, dpi & 0xff, dpi >> 8, ...rgb);

/** A GET reply echoes the request's bytes 0-3. SET gets no reply at all. */
export const isEcho = (req: Uint8Array, res: Uint8Array) => res.length >= 4 && req.subarray(0, 4).every((b, i) => b === res[i]);

const u16le = (b: Uint8Array, i: number) => b[i]! | (b[i + 1]! << 8);
const u16be = (b: Uint8Array, i: number) => (b[i]! << 8) | b[i + 1]!;

export interface Ident {
  firmware: string;
  bootloader: string;
  vendorId: number;
  productId: number;
  pollingRateHz: number | null;
}

const version = (v: number) => `${v >> 8}.${(v & 0xff).toString(16).padStart(2, '0')}`;

export function decodeIdent(res: Uint8Array): Ident | null {
  if (res.length < 17) return null;
  const pollMs = res[16]!;
  return {
    firmware: version(u16le(res, 8)),
    bootloader: version(u16le(res, 10)),
    vendorId: u16le(res, 12),
    productId: u16le(res, 14),
    pollingRateHz: pollMs ? Math.round(1000 / pollMs) : null,
  };
}

export const decodeByte = (res: Uint8Array) => (res.length >= 5 ? res[4]! : null);
export const decodeCurrent = (res: Uint8Array) => (res.length >= 9 ? { stage: res[4]!, x: u16be(res, 5), y: u16be(res, 7) } : null);

export interface Stage {
  x: number;
  y: number;
  rgb: [number, number, number];
}

export const decodeStage = (res: Uint8Array): Stage | null =>
  res.length >= 12 ? { x: u16be(res, 5), y: u16be(res, 7), rgb: [res[9]!, res[10]!, res[11]!] } : null;

/** Enabled stages from the mask, ascending. */
export const enabledStages = (mask: number) => Array.from({ length: STAGES }, (_, i) => i).filter((i) => mask & (1 << i));

/**
 * Allowlist: the GETs above and the four live SETs OpenMouse confirmed on a
 * NIGHTSWORD (active stage, stage DPI with colour, lift 1-5, angle snap), all
 * with profile byte 0 and zero padding. Stage mask, polling (the mouse
 * re-enumerates), profile name/ID, stored-profile and firmware traffic are refused.
 */
export function allow(r: OutgoingReport): boolean {
  if (r.reportId !== REPORT_ID) return false;
  if (r.type === 'feature-read') return true;
  const b = r.data;
  if (r.type !== 'feature' || b.length !== SIZE) return false;
  const zeroFrom = (i: number) => b.subarray(i).every((x) => x === 0);
  const [cmd, field, sub, profile] = [b[0]!, b[1]!, b[2]!, b[3]!];
  if (cmd === GET && field === FIELD.ident) return zeroFrom(2);
  if (field !== FIELD.mouse || profile !== LIVE) return false;
  const isStage = sub >= MOUSE.stage && sub < MOUSE.stage + STAGES;
  if (cmd === GET) return ([MOUSE.dpi, MOUSE.lift, MOUSE.snap, MOUSE.mask] as number[]).includes(sub) || isStage ? zeroFrom(4) : false;
  if (cmd !== SET) return false;
  if (sub === MOUSE.dpi) return b[4]! < STAGES && zeroFrom(5);
  if (sub === MOUSE.lift) return b[4]! >= LIFT.min && b[4]! <= LIFT.max && zeroFrom(5);
  if (sub === MOUSE.snap) return b[4]! <= 1 && (b[5] === 0 || b[5] === 0x05) && zeroFrom(6);
  if (isStage) {
    const x = u16le(b, 5);
    const y = u16le(b, 7);
    return b[4] === 0 && x === y && x >= DPI_BOUNDS.min && x <= DPI_BOUNDS.max && zeroFrom(12);
  }
  return false;
}
