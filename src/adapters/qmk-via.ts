// Protocol adapter for QMK keyboards built with VIA. Facts and sources:
// docs/protocols/qmk-via.md. Command, channel and value IDs are transcribed
// from QMK quantum/via.h (https://github.com/qmk/qmk_firmware, commit
// 7a1bbf37, GPL-2.0-or-later). Status: experimental.

import type { OutgoingReport } from '../lib/transport.ts';

/** QMK raw HID: no report ID, 32-byte reports both ways. */
export const REPORT_ID = 0;
export const PAYLOAD = 32;

export const CMD = {
  protocolVersion: 0x01,
  setValue: 0x07,
  getValue: 0x08,
  save: 0x09,
  layerCount: 0x11,
  unhandled: 0xff,
} as const;

export type Channel = 'backlight' | 'rgblight' | 'rgbMatrix' | 'ledMatrix';
export type Value = 'brightness' | 'effect' | 'speed' | 'color';

export const CHANNEL_ID: Record<Channel, number> = { backlight: 1, rgblight: 2, rgbMatrix: 3, ledMatrix: 5 };
export const CHANNELS = Object.keys(CHANNEL_ID) as Channel[];
/** Value IDs are the same on every lighting channel; each channel has a subset. */
export const VALUE_ID: Record<Value, number> = { brightness: 1, effect: 2, speed: 3, color: 4 };
export const VALUES: Record<Channel, Value[]> = {
  backlight: ['brightness', 'effect'],
  rgblight: ['brightness', 'effect', 'speed', 'color'],
  rgbMatrix: ['brightness', 'effect', 'speed', 'color'],
  ledMatrix: ['brightness', 'effect', 'speed'],
};
/** Colour is hue and saturation; everything else is one byte. */
export const width = (v: Value) => (v === 'color' ? 2 : 1);
/** Backlight "effect" is breathing on/off; other values take the full byte. */
export const maxOf = (ch: Channel, v: Value) => (ch === 'backlight' && v === 'effect' ? 1 : 255);

/** Versions whose command table UDB knows (handshake and layer count). */
export const knownVersion = (v: number | null): v is number => v !== null && v >= 0x09 && v <= 0x0d;
/** Versions with channel-based custom values (QMK 0.19+). Older ones reuse 07-09 for a different lighting layout. */
export const hasChannels = (v: number | null) => v !== null && v >= 0x0c && v <= 0x0d;

function frame(...bytes: number[]): OutgoingReport {
  const data = new Uint8Array(PAYLOAD);
  data.set(bytes);
  return { type: 'output', reportId: REPORT_ID, data };
}

export const protocolVersion = () => frame(CMD.protocolVersion);
export const layerCount = () => frame(CMD.layerCount);
export const getValue = (ch: Channel, v: Value) => frame(CMD.getValue, CHANNEL_ID[ch], VALUE_ID[v]);
export const setValue = (ch: Channel, v: Value, bytes: number[]) => frame(CMD.setValue, CHANNEL_ID[ch], VALUE_ID[v], ...bytes);
export const save = (ch: Channel) => frame(CMD.save, CHANNEL_ID[ch]);

const channelOf = (id: number | undefined) => CHANNELS.find((c) => CHANNEL_ID[c] === id);
const valueOf = (ch: Channel, id: number | undefined) => VALUES[ch].find((v) => VALUE_ID[v] === id);

/** How many leading request bytes the reply echoes (the command and its arguments). */
function echoLength(req: Uint8Array): number {
  switch (req[0]) {
    case CMD.getValue:
      return 3;
    case CMD.save:
      return 2;
    case CMD.setValue: {
      const ch = channelOf(req[1]);
      const v = ch && valueOf(ch, req[2]);
      return 3 + (v ? width(v) : 0);
    }
    default:
      return 1;
  }
}

/**
 * True when `res` answers `req`: byte 0 is the command or FF (unhandled) and
 * the arguments are echoed. Replies can arrive late or unsolicited, so order
 * proves nothing (tests/fixtures/via-issue-logs.json).
 */
export function isReply(req: Uint8Array, res: Uint8Array): boolean {
  if (res.length < PAYLOAD) return false;
  if (res[0] !== req[0] && res[0] !== CMD.unhandled) return false;
  const n = echoLength(req);
  for (let i = 1; i < n; i++) if (res[i] !== req[i]) return false;
  return true;
}

export const unhandled = (res: Uint8Array) => res[0] === CMD.unhandled;

/** The VIA protocol version, or null when the device did not answer as VIA. */
export function decodeVersion(res: Uint8Array): number | null {
  if (res.length < 3 || res[0] !== CMD.protocolVersion) return null;
  return (res[1]! << 8) | res[2]!;
}

export function decodeLayerCount(res: Uint8Array): number | null {
  if (res.length < 2 || res[0] !== CMD.layerCount || res[1]! < 1 || res[1]! > 32) return null;
  return res[1]!;
}

/** The value bytes of a get reply (one byte, or hue and saturation). Null when unhandled or malformed. */
export function decodeValue(req: Uint8Array, res: Uint8Array): number[] | null {
  if (req[0] !== CMD.getValue || res.length < PAYLOAD || res[0] !== CMD.getValue || !isReply(req, res)) return null;
  const ch = channelOf(req[1]);
  const v = ch && valueOf(ch, req[2]);
  if (!v) return null;
  const bytes = Array.from(res.subarray(3, 3 + width(v)));
  return bytes.every((b, i) => b <= (i === 0 ? maxOf(ch, v) : 255)) ? bytes : null;
}

const zeroFrom = (b: Uint8Array, i: number) => b.subarray(i).every((x) => x === 0);

/**
 * The allowlist depends on what the keyboard said in the handshake: before
 * it, only `01` (get protocol version); with a known version, the layer
 * count; with channel-based custom values, get/set/save on the four QMK
 * lighting channels. Bootloader, EEPROM and keymap resets, keymap/macro/buffer
 * writes, matrix state (keystrokes), channel 0 and Vial commands are refused.
 */
export function allowFor(version: number | null): (r: OutgoingReport) => boolean {
  return (r) => {
    const b = r.data;
    if (r.type !== 'output' || r.reportId !== REPORT_ID || b.length !== PAYLOAD) return false;
    if (b[0] === CMD.protocolVersion) return zeroFrom(b, 1);
    if (!knownVersion(version)) return false;
    if (b[0] === CMD.layerCount) return zeroFrom(b, 1);
    if (!hasChannels(version)) return false;
    const ch = channelOf(b[1]);
    if (!ch) return false;
    if (b[0] === CMD.save) return zeroFrom(b, 2);
    const v = valueOf(ch, b[2]);
    if (!v) return false;
    if (b[0] === CMD.getValue) return zeroFrom(b, 3);
    if (b[0] === CMD.setValue) return b[3]! <= maxOf(ch, v) && zeroFrom(b, 3 + width(v));
    return false;
  };
}
