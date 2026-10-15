// Protocol adapter for SteelSeries Arctis Nova 7 headsets.
//
// Command bytes and parsing are ported from HeadsetControl
// (https://github.com/Sapd/HeadsetControl, GPL-3.0, by the HeadsetControl
// contributors): lib/devices/steelseries_arctis_nova_7.hpp and
// lib/devices/protocols/steelseries_protocol.hpp, master on 2026-10-15.
// Status: experimental. No Nova 7 has been tested with UDB (ADR 7).

import type { OutgoingReport } from '../lib/transport.ts';

/** HeadsetControl writes 64 bytes with byte 0 = 0x00: no report ID, 63-byte payload. */
export const REPORT_ID = 0;
export const PAYLOAD = 63;

export const GEN2_PID = 0x227e;
/** PIDs reporting battery as 0-4 steps instead of a percentage. */
const DISCRETE_BATTERY_PIDS = [0x2202, 0x2206, 0x220a, 0x223a, 0x227a, 0x22a4];

export const CMD = {
  status: 0xb0,
  readSettings: 0x20,
  sidetone: 0x39,
  save: 0x09,
  inactiveTime: 0xa3,
} as const;

function frame(...bytes: number[]): OutgoingReport {
  const data = new Uint8Array(PAYLOAD);
  data.set(bytes);
  return { type: 'output', reportId: REPORT_ID, data };
}

export const statusRequest = () => frame(CMD.status);
export const readSettings = () => frame(CMD.readSettings);
export const setSidetone = (level: number) => frame(CMD.sidetone, level);
export const save = () => frame(CMD.save);
export const setInactiveTime = (minutes: number) => frame(CMD.inactiveTime, minutes);

/** Allowlist: exact command shapes only. EQ, mic, Bluetooth and anything else are refused. */
export function allow(r: OutgoingReport): boolean {
  const b = r.data;
  if (r.type !== 'output' || r.reportId !== REPORT_ID || b.length !== PAYLOAD) return false;
  const restZero = (from: number) => b.subarray(from).every((v) => v === 0);
  switch (b[0]) {
    case CMD.status:
    case CMD.readSettings:
    case CMD.save:
      return restZero(1);
    case CMD.sidetone:
      return b[1]! <= 3 && restZero(2);
    case CMD.inactiveTime:
      return b[1]! <= 90 && restZero(2);
    default:
      return false;
  }
}

export interface Status {
  online: boolean;
  charging: boolean;
  batteryPercent: number;
  chatmix: { game: number; chat: number };
}

export function decodeStatus(res: Uint8Array, pid: number): Status | null {
  if (res.length < 6 || res[0] !== CMD.status) return null;
  const raw = res[2]!;
  const percent = DISCRETE_BATTERY_PIDS.includes(pid) ? Math.round((Math.min(raw, 4) / 4) * 100) : Math.min(raw, 100);
  return {
    online: res[3] !== 0,
    charging: res[3] === 1 || res[3] === 2,
    batteryPercent: percent,
    chatmix: { game: res[4]!, chat: res[5]! },
  };
}

/** Sidetone 0-3 from a 0x20 settings report (Gen 2 only). Null for anything else. */
export function decodeSidetone(res: Uint8Array): number | null {
  if (res.length < 4 || res[0] !== CMD.readSettings) return null;
  return res[2]! <= 3 ? res[2]! : null;
}

export const canReadSidetone = (pid: number) => pid === GEN2_PID;
