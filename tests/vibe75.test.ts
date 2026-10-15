import { describe, expect, it, vi } from 'vitest';
import * as v from '../src/adapters/vibe75.ts';
import { Vibe75Session } from '../src/adapters/vibe75-session.ts';
import { TransportRejected } from '../src/lib/transport.ts';

const payload = (...bytes: number[]) => {
  const b = new Uint8Array(v.PAYLOAD);
  b.set(bytes);
  return b;
};

// Reply layout from the XVX G75 notes (same OEM family): documentation, not captured from a Vibe75.
const xvxProfile1 = payload(11, 0xff, 0, 0, 0, 0, 0, 0, 1, 5, 3, 0, 0, 0, 0xaa, 0x55);
const xvxEmpty = payload(0x04, 0x12, 2, 0xff);

describe('vibe75 framing', () => {
  it('reads lighting with a 64-byte feature report 0: 04 12 <profile>', () => {
    expect(v.readLighting(3)).toEqual({ type: 'feature', reportId: 0, data: payload(0x04, 0x12, 3) });
  });

  it('decodes a configured block and treats a reply without AA 55 as empty', () => {
    expect(v.decodeLighting(xvxProfile1)).toEqual({ mode: 11, color: [0xff, 0, 0], profile: 1, brightness: 5, speed: 3, byte11: 0 });
    expect(v.decodeLighting(xvxEmpty)).toBeNull();
  });
});

describe('vibe75 allowlist (read-only release)', () => {
  it('allows only lighting reads for profiles 0-4 and GET_FEATURE', () => {
    for (const p of v.PROFILES) expect(v.allow(v.readLighting(p))).toBe(true);
    expect(v.allow({ type: 'feature-read', reportId: 0, data: new Uint8Array() })).toBe(true);
  });

  it.each([
    ['INIT/reset (01)', payload(0x01)],
    ['begin write session (04 18)', payload(0x04, 0x18)],
    ['lighting header (04 13)', payload(0x04, 0x13, 0, 0, 0, 0, 0, 0, 1)],
    ['system settings (04 17)', payload(0x04, 0x17, 1, 0, 0, 0, 0, 0, 1)],
    ['key table (04 20)', payload(0x04, 0x20, 0, 0, 0, 0, 0, 0, 3)],
    ['LCD upload (04 72)', payload(0x04, 0x72)],
    ['end session (04 02)', payload(0x04, 0x02)],
    ['04 F0', payload(0x04, 0xf0)],
    ['profile 5', payload(0x04, 0x12, 5)],
    ['read with trailing bytes', payload(0x04, 0x12, 1, 1)],
  ])('refuses %s', (_name, data) => {
    expect(v.allow({ type: 'feature', reportId: 0, data })).toBe(false);
  });

  it('refuses output reports and other report IDs', () => {
    expect(v.allow({ type: 'output', reportId: 0, data: payload(0x04, 0x12, 1) })).toBe(false);
    expect(v.allow({ type: 'feature', reportId: 1, data: payload(0x04, 0x12, 1) })).toBe(false);
  });
});

describe('vibe75 session', () => {
  function fakeKeyboard(replies: Record<number, Uint8Array>) {
    let lastProfile = 0;
    return {
      opened: true,
      collections: [{ usagePage: 0xff13, usage: 0x0001, featureReports: [{ reportId: 0 }] }],
      sendReport: vi.fn(),
      sendFeatureReport: vi.fn(async (_id: number, data: BufferSource) => {
        lastProfile = new Uint8Array(data as ArrayBuffer)[2]!;
      }),
      receiveFeatureReport: vi.fn(async () => new DataView((replies[lastProfile] ?? payload(0x04, 0x12, lastProfile, 0xff)).slice().buffer)),
    };
  }

  it('probes all five profiles read-only and decodes what it finds', async () => {
    const kb = fakeKeyboard({ 1: xvxProfile1 });
    const readings = await new Vibe75Session(kb, []).probe();
    expect(readings.map((r) => r.block?.mode ?? null)).toEqual([null, 11, null, null, null]);
    expect(kb.sendFeatureReport).toHaveBeenCalledTimes(5);
  });

  it('cannot reach a denied collection', async () => {
    const kb = fakeKeyboard({});
    await expect(new Vibe75Session(kb, [{ usagePage: 0xff13, usage: 0x0001 }]).probe()).rejects.toBeInstanceOf(TransportRejected);
    expect(kb.sendFeatureReport).not.toHaveBeenCalled();
  });
});
