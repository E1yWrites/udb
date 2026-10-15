import { describe, expect, it } from 'vitest';
import * as cx from '../src/adapters/compx.ts';
import { CompxSession } from '../src/adapters/compx-session.ts';
import { applySetting } from '../src/lib/write.ts';
import { TransportRejected, TransportTimeout, type OutgoingReport } from '../src/lib/transport.ts';
import { CompxSim } from './compx-sim.ts';

const out = (bytes: number[]): OutgoingReport => {
  const data = new Uint8Array(16);
  data.set(bytes);
  data[15] = cx.checksum(data);
  return { type: 'output', reportId: 8, data };
};

describe('compx framing', () => {
  it('checksums like the vendor driver: (0x55 − (8 + Σ bytes 0..14)) & 0xFF', () => {
    expect(cx.readFlash(0, 10).data).toEqual(Uint8Array.of(8, 0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x3b));
  });

  it('stores one-byte settings next to their complement and rejects corrupt pairs', () => {
    expect(cx.encodePair(2)).toEqual([2, 0x53]);
    expect(cx.decodePair(Uint8Array.of(2, 0x53))).toBe(2);
    expect(cx.decodePair(Uint8Array.of(2, 0x54))).toBeNull();
  });

  it('maps polling rates both ways', () => {
    for (const hz of cx.POLLING_RATES) expect(cx.codeToRate(cx.rateToCode(hz))).toBe(hz);
    expect([125, 250, 500, 1000, 2000, 4000, 8000].map(cx.rateToCode)).toEqual([8, 4, 2, 1, 16, 32, 64]);
    expect(cx.codeToRate(3)).toBeNull();
  });
});

describe('compx allowlist', () => {
  it('allows identity, plain online, battery, bounded reads and the two writable settings', () => {
    expect(cx.allow(cx.encryptionData([1, 2, 3, 4]))).toBe(true);
    expect(cx.allow(cx.deviceOnLine())).toBe(true);
    expect(cx.allow(cx.batteryLevel())).toBe(true);
    expect(cx.allow(cx.readFlash(0xf6, 10))).toBe(true);
    expect(cx.allow(cx.writeFlash(0x00, cx.encodePair(2)))).toBe(true);
    expect(cx.allow(cx.writeFlash(0x04, cx.encodePair(1)))).toBe(true);
    expect(cx.allow(cx.writeFlash(0xa9, cx.encodePair(15)))).toBe(true);
  });

  it.each([
    ['EnterUsbUpdateMode (firmware)', [13]],
    ['EnterMTKMode', [17]],
    ['SetDeviceVidPid', [11]],
    ['SetDeviceDescriptorString', [12]],
    ['WriteKBCIdMID', [240]],
    ['ClearSetting (factory reset)', [9]],
    ['DongleEnterPair', [5]],
    ['DeviceOnLine with the unknown byte-5 flag', [3, 0, 0, 0, 0, 1]],
    ['WriteFlashData to DPI values (0x0C)', [7, 0, 0, 0x0c, 4, 1, 2, 3, 4]],
    ['WriteFlashData to the stage count (0x02)', [7, 0, 0, 0x02, 2, 6, 0x4f]],
    ['WriteFlashData with extra bytes', [7, 0, 0, 0x00, 2, 1, 0x54, 9]],
    ['ReadFlashData past 0xFF', [8, 0, 0, 0xfa, 10]],
    ['ReadFlashData over 10 bytes', [8, 0, 0, 0, 11]],
    ['a polling-rate code that is not a rate', [7, 0, 0, 0x00, 2, 3, 0x52]],
    ['debounce above 15 ms', [7, 0, 0, 0xa9, 2, 16, 0x45]],
    ['a write whose complement does not match', [7, 0, 0, 0x00, 2, 1, 0x53]],
  ])('refuses %s', (_name, bytes) => {
    expect(cx.allow(out(bytes))).toBe(false);
  });

  it('refuses a frame with a bad checksum or the wrong report ID', () => {
    const r = cx.deviceOnLine();
    expect(cx.allow({ ...r, data: Uint8Array.from(r.data, (v, i) => (i === 15 ? v ^ 1 : v)) })).toBe(false);
    expect(cx.allow({ ...r, reportId: 9 })).toBe(false);
  });
});

describe('compx session (simulator, not hardware evidence)', () => {
  it('identifies the device and reads its settings', async () => {
    const s = new CompxSession(new CompxSim({ mid: 42, type: 5 }), []);
    expect(await s.identify()).toEqual({ cid: 87, mid: 42, type: 5, wired: false, maxRate: 8000 });
    expect(await s.pollingRate(await s.identify()).read()).toBe(1000);
    expect(await s.readPair(cx.ADDR.stageCount)).toBe(6);
    expect(await s.battery()).toEqual({ level: 82, charging: false });
    expect(s.log.filter((e) => e.dir === 'tx').length).toBeGreaterThan(0);
  });

  it('writes through the shared procedure and confirms only what the device reads back', async () => {
    const sim = new CompxSim();
    const s = new CompxSession(sim, []);
    const rate = s.pollingRate(await s.identify());
    expect(await applySetting(rate, 500, 1000)).toEqual({ kind: 'confirmed', value: 500 });
    expect([...sim.flash.subarray(0, 2)]).toEqual([2, 0x53]);
    expect(await applySetting(s.activeStage(6), 3, 1)).toEqual({ kind: 'confirmed', value: 3 });
  });

  it('reports a mismatch and restores when the device ignores the write', async () => {
    const s = new CompxSession(new CompxSim({ ignoreWrites: true }), []);
    const rate = s.pollingRate(await s.identify());
    expect(await applySetting(rate, 500, 1000)).toEqual({
      kind: 'mismatch',
      requested: 500,
      actual: 1000,
      restored: 1000,
      restoreConfirmed: true,
    });
  });

  it('refuses invalid values before sending anything', async () => {
    const sim = new CompxSim({ type: 0 });
    const s = new CompxSession(sim, []);
    const rate = s.pollingRate(await s.identify());
    const sentBefore = sim.sent.length;
    expect(await applySetting(rate, 8000, 1000)).toEqual({ kind: 'invalid', reason: 'This connection supports up to 1000 Hz' });
    expect(await applySetting(s.activeStage(6), 6, 1)).toMatchObject({ kind: 'invalid' });
    expect(sim.sent.length).toBe(sentBefore);
  });

  it('refuses to write while the mouse is asleep', async () => {
    const s = new CompxSession(new CompxSim({ online: false }), []);
    const result = await applySetting(s.activeStage(6), 2, 1);
    expect(result).toMatchObject({ kind: 'failed' });
  });

  it('times out on a silent link', async () => {
    const s = new CompxSession(new CompxSim({ silent: true }), []);
    await expect(s.identify()).rejects.toBeInstanceOf(TransportTimeout);
  });

  it('rejects replies whose checksum is wrong', () => {
    // Real identify reply from the CrazyLight (2026-10-15), then the same with one bit flipped.
    const real = Uint8Array.of(0x01, 0, 0, 0, 8, 0x02, 0x3d, 0x26, 0x9a, 0x57, 0x52, 0x05, 0, 0, 0, 0x97);
    expect(cx.decodeInfo(real)).toMatchObject({ cid: 87, mid: 82, type: 5 });
    expect(() => cx.decodeInfo(Uint8Array.from(real, (v, i) => (i === 10 ? v ^ 1 : v)))).toThrow(/checksum/);
  });

  it('writes debounce within the model range', async () => {
    const s = new CompxSession(new CompxSim(), []);
    expect(await applySetting(s.debounce(15), 3, 2)).toEqual({ kind: 'confirmed', value: 3 });
    expect(await applySetting(s.debounce(15), 16, 3)).toMatchObject({ kind: 'invalid' });
  });

  it('cannot be talked into a denied collection', async () => {
    const s = new CompxSession(new CompxSim(), [{ usagePage: 0xff02, usage: 0x0002 }]);
    await expect(s.identify()).rejects.toBeInstanceOf(TransportRejected);
  });
});
