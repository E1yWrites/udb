// Replays bytes captured from real hardware (tests/fixtures). Encoders must
// produce the same frames, the allowlist must accept them, and decoders must
// read the device's replies the same way they did on the day.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as cx from '../src/adapters/compx.ts';

const fixture = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/compx-crazylight-2026-10-15.json'), 'utf8')) as {
  exchanges: { op: string; tx: string; rx: string }[];
};
const bytes = (hex: string) => Uint8Array.from(hex.split(' '), (h) => parseInt(h, 16));
const ex = fixture.exchanges.map((e) => ({ op: e.op, tx: bytes(e.tx), rx: bytes(e.rx) }));

describe('compx replay: X2 CrazyLight, 2026-10-15', () => {
  it.each(ex.map((e) => [e.op, e]))('%s: allowlisted request, matching and checksummed reply', (_op, e) => {
    expect(cx.allow({ type: 'output', reportId: cx.REPORT_ID, data: e.tx })).toBe(true);
    expect(cx.isResponse(e.tx, e.rx)).toBe(true);
    expect(e.rx[15]).toBe(cx.checksum(e.rx));
  });

  it('encoders reproduce the captured requests', () => {
    expect(cx.deviceOnLine().data).toEqual(ex[1]!.tx);
    expect(cx.readFlash(0x02, 2).data).toEqual(ex[2]!.tx);
    expect(cx.batteryLevel().data).toEqual(ex[5]!.tx);
    expect(cx.writeFlash(0x00, cx.encodePair(cx.rateToCode(8000))).data).toEqual(ex[6]!.tx);
    expect(cx.writeFlash(0x00, cx.encodePair(cx.rateToCode(1000))).data).toEqual(ex[8]!.tx);
    expect(cx.encryptionData([0x4e, 0x5d, 0x31, 0x93]).data).toEqual(ex[0]!.tx);
  });

  it('decodes what the device said', () => {
    expect(cx.decodeInfo(ex[0]!.rx)).toEqual({ cid: 87, mid: 82, type: 5, wired: false, maxRate: 8000 });
    expect(cx.decodeOnline(ex[1]!.rx)).toEqual({ online: true, busy: false });
    expect(cx.decodePair(cx.decodeFlash(ex[2]!.tx, ex[2]!.rx))).toBe(1);
    expect(cx.codeToRate(cx.decodePair(cx.decodeFlash(ex[7]!.tx, ex[7]!.rx))!)).toBe(8000);
    expect(cx.codeToRate(cx.decodePair(cx.decodeFlash(ex[9]!.tx, ex[9]!.rx))!)).toBe(1000);
    expect(cx.decodePair(cx.decodeFlash(ex[4]!.tx, ex[4]!.rx))).toBe(0);
    expect(cx.decodeBattery(ex[5]!.rx)).toEqual({ level: 100, charging: false });
  });

  it('session 2: settings survived the replug, debounce wrote and read back', () => {
    expect(cx.codeToRate(cx.decodePair(cx.decodeFlash(ex[10]!.tx, ex[10]!.rx))!)).toBe(500);
    expect(cx.decodePair(cx.decodeFlash(ex[11]!.tx, ex[11]!.rx))).toBe(3);
    expect(cx.writeFlash(cx.ADDR.debounce, cx.encodePair(2)).data).toEqual(ex[12]!.tx);
    expect(cx.decodePair(cx.decodeFlash(ex[13]!.tx, ex[13]!.rx))).toBe(2);
    expect(cx.decodeInfo(ex[14]!.rx)).toMatchObject({ cid: 87, mid: 82 });
  });
});
