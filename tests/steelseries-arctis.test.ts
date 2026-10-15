// Bytes below are derived from HeadsetControl's source, not captured from a
// headset. They prove UDB's encoding matches HeadsetControl, nothing more:
// the adapter stays `experimental` until a Nova 7 is tested (ADR 7).
import { describe, expect, it } from 'vitest';
import * as ss from '../src/adapters/steelseries-arctis.ts';

const payload = (...bytes: number[]) => {
  const b = new Uint8Array(ss.PAYLOAD);
  b.set(bytes);
  return b;
};

describe('steelseries-arctis encoding (from HeadsetControl source)', () => {
  it('frames commands as report 0 with a zero-padded 63-byte payload', () => {
    expect(ss.setSidetone(2)).toEqual({ type: 'output', reportId: 0, data: payload(0x39, 2) });
    expect(ss.statusRequest().data).toEqual(payload(0xb0));
    expect(ss.readSettings().data).toEqual(payload(0x20));
    expect(ss.save().data).toEqual(payload(0x09));
    expect(ss.setInactiveTime(30).data).toEqual(payload(0xa3, 30));
  });

  it('allows only the Phase 3 command shapes', () => {
    for (const r of [ss.statusRequest(), ss.readSettings(), ss.save(), ss.setSidetone(3), ss.setInactiveTime(90)]) {
      expect(ss.allow(r)).toBe(true);
    }
  });

  it.each([
    ['sidetone above 3', payload(0x39, 4)],
    ['equalizer', payload(0x33, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 0)],
    ['mic volume', payload(0x37, 7)],
    ['Bluetooth save variant', payload(0x06, 0x09)],
    ['volume limiter', payload(0x3a, 1)],
    ['trailing bytes', payload(0x39, 1, 1)],
  ])('refuses %s', (_name, data) => {
    expect(ss.allow({ type: 'output', reportId: 0, data })).toBe(false);
  });

  it('refuses the wrong report ID or length', () => {
    expect(ss.allow({ ...ss.setSidetone(1), reportId: 1 })).toBe(false);
    expect(ss.allow({ type: 'output', reportId: 0, data: new Uint8Array(64) })).toBe(false);
  });

  it('decodes status with the PID-specific battery scale', () => {
    const res = Uint8Array.of(0xb0, 0, 3, 3, 64, 36);
    expect(ss.decodeStatus(res, 0x2202)).toEqual({ online: true, charging: false, batteryPercent: 75, chatmix: { game: 64, chat: 36 } });
    expect(ss.decodeStatus(Uint8Array.of(0xb0, 0, 87, 1, 0, 0), ss.GEN2_PID)).toMatchObject({ batteryPercent: 87, charging: true });
    expect(ss.decodeStatus(Uint8Array.of(0xb0, 0, 0, 0, 0, 0), ss.GEN2_PID)).toMatchObject({ online: false });
    expect(ss.decodeStatus(Uint8Array.of(0x20, 0, 2, 0, 0, 0), ss.GEN2_PID)).toBeNull();
  });

  it('reads sidetone only from a 0x20 settings report, and only on Gen 2', () => {
    expect(ss.decodeSidetone(Uint8Array.of(0x20, 0, 2, 0))).toBe(2);
    expect(ss.decodeSidetone(Uint8Array.of(0xb0, 0, 2, 0))).toBeNull();
    expect(ss.decodeSidetone(Uint8Array.of(0x20, 0, 9, 0))).toBeNull();
    expect(ss.canReadSidetone(ss.GEN2_PID)).toBe(true);
    expect(ss.canReadSidetone(0x2202)).toBe(false);
  });
});
