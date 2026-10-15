import { describe, expect, it } from 'vitest';
import * as hp from '../src/adapters/logitech-hidpp.ts';
import { HidppSession } from '../src/adapters/logitech-hidpp-session.ts';
import { applySetting } from '../src/lib/write.ts';
import { TransportRejected, type OutgoingReport } from '../src/lib/transport.ts';
import { EXTENDED_DPI_OPTIONS, HidppSim, LEGACY_DPI_OPTIONS, type HidppSimOptions } from './logitech-hidpp-sim.ts';
import observed from './fixtures/openmouse-logitech-observations.json';

const LIGHTSPEED = 0xc539;
const G402 = 0xc07e;
const sw = (fn: number) => (fn << 4) | hp.SW_ID;
const long = (bytes: number[]): OutgoingReport => {
  const data = new Uint8Array(hp.SIZE[hp.LONG]);
  data.set(bytes);
  return { type: 'output', reportId: hp.LONG, data };
};
const reply = (bytes: number[]) => {
  const r = new Uint8Array(hp.SIZE[hp.LONG]);
  r.set(bytes);
  return r;
};
const session = (opts: HidppSimOptions) => {
  const sim = new HidppSim(opts);
  return { sim, s: new HidppSession(sim.interfaces, opts.productId, []) };
};

describe('logitech-hidpp framing', () => {
  it('builds long requests with UDB’s software ID', () => {
    expect(hp.frame(hp.LONG, 0x01, 0x00, 0, [0x22, 0x02])).toEqual(long([0x01, 0x00, 0x0a, 0x22, 0x02]));
    expect(hp.frame(hp.SHORT, 0xff, 0x05, 3, [0, 0x06, 0x40]).data).toEqual(Uint8Array.of(0xff, 0x05, 0x3a, 0, 0x06, 0x40));
    expect(() => hp.frame(hp.SHORT, 0xff, 0x05, 6, [0, 1, 2, 3])).toThrow(/at most 3/);
  });

  it('matches replies, HID++ 2.0 and 1.0 errors, and ignores notifications and other slots', () => {
    const req = hp.frame(hp.LONG, 0x01, 0x05, 5, [0]).data;
    expect(hp.isReply(req, reply([0x01, 0x05, sw(5), 0, 0x06, 0x40]))).toBe(true);
    expect(hp.isReply(req, reply([0x01, 0xff, 0x05, sw(5), 0x02]))).toBe(true);
    expect(hp.isReply(req, reply([0x01, 0x8f, 0x05, sw(5), 0x08]))).toBe(true);
    expect(hp.isReply(req, reply([0x01, 0x05, 0x00, 0, 0x06, 0x40]))).toBe(false); // software ID 0: a notification
    expect(hp.isReply(req, reply([0x02, 0x05, sw(5), 0]))).toBe(false);
    expect(hp.errorOf(reply([0x01, 0xff, 0x05, sw(5), 0x02]))?.message).toMatch(/HID\+\+ 2\.0: invalid argument/);
    expect(hp.errorOf(reply([0x01, 0x8f, 0x05, sw(5), 0x08]))?.message).toMatch(/HID\+\+ 1\.0: unknown device/);
  });
});

describe('logitech-hidpp decoders (OpenMouse hardware observations)', () => {
  const [receiver, g402, superstrike, superlight, rejected] = observed.observations;

  it('decodes the G402 report-rate bitmap', () => {
    expect(hp.decodeReportRateBitmap(g402!.bitmap!)).toEqual(g402!.rates);
  });

  it('decodes the PRO X 2 Superstrike’s transport PIDs', () => {
    const r = reply([0xff, 0x02, sw(0), 1, 0x12, 0x34, 0x56, 0x78, 0, superstrike!.transportFlags!, 0x40, 0xbd, 0xc0, 0xa8]);
    expect(hp.decodeDeviceInfo(r)).toEqual({ bluetoothPid: null, blePid: null, wirelessPid: 0x40bd, usbPid: 0xc0a8 });
  });

  it('decodes the Superlight 2’s cable and wireless rate masks', () => {
    const mask = (m: number) => reply([0x01, 0x06, sw(1), m >> 8, m & 0xff]);
    expect(hp.decodeRateMask(mask(superlight!.cableMask!))).toEqual(superlight!.cableRates);
    expect(hp.decodeRateMask(mask(superlight!.wirelessMask!))).toEqual(superlight!.wirelessRates);
  });

  it('names the errors OpenMouse saw', () => {
    expect(new hp.HidppError(1, receiver!.emptySlotError!.code).message).toMatch(/unknown device/);
    expect(new hp.HidppError(1, receiver!.receiverIndexError!.code).message).toMatch(/invalid command/);
    expect(new hp.HidppError(2, rejected!.error!.code).message).toMatch(/invalid argument/);
  });

  it('expands DPI ranges and rejects malformed ones', () => {
    expect(hp.decodeDpiList([0x00, 0x64, 0xe0, 0x32, 0x01, 0x2c, 0, 0])).toEqual([100, 150, 200, 250, 300]);
    expect(hp.decodeDpiList([0xe0, 0x32, 0x01, 0x2c])).toBeNull();
    expect(hp.decodeDpiList([0x01, 0x2c, 0xe0, 0x32, 0x00, 0x64])).toBeNull();
  });

  it('reads a DPI of 0 as the default (Solaar), and battery codes per feature', () => {
    expect(hp.decodeLegacyDpi(reply([0xff, 0x05, sw(2), 0, 0, 0, 0x03, 0x20]))).toBe(800);
    expect(hp.decodeUnifiedBattery(reply([1, 4, sw(1), 50, 0, 2])).state).toBe('charging slowly');
    expect(hp.decodeBatteryLevel(reply([1, 4, sw(0), 50, 0, 2])).state).toBe('almost full');
    expect(hp.decodeUnifiedBattery(reply([1, 4, sw(1), 0xff, 0, 0])).percent).toBeNull();
    expect(hp.estimatePercent(3811)).toBe(50);
  });
});

describe('logitech-hidpp allowlist', () => {
  const features = new Map([
    [hp.FEATURE.deviceName, 3],
    [hp.FEATURE.dpi, 5],
    [hp.FEATURE.extendedDpi, 6],
    [hp.FEATURE.reportRate, 7],
    [hp.FEATURE.extendedReportRate, 8],
    [hp.FEATURE.onboardProfiles, 9],
    [0x00d0, 10], // DFU, as if a device reported it
    [0x1814, 11], // change host
  ]);
  const allow = hp.allowFor(features);

  it('allows the documented functions in shape', () => {
    expect(allow(long([0x01, 0x00, sw(0), 0x00, 0xd0]))).toBe(true); // looking DFU up is harmless
    expect(allow(long([0x01, 0x00, sw(1), 0, 0, 0x5a]))).toBe(true);
    expect(allow(long([0x01, 3, sw(1), 16]))).toBe(true);
    expect(allow(long([0xff, 5, sw(3), 0, 0x06, 0x40]))).toBe(true);
    expect(allow(long([0x01, 6, sw(6), 0, 0x06, 0x40, 0x06, 0x40, 2]))).toBe(true);
    expect(allow(long([0x01, 7, sw(2), 8]))).toBe(true);
    expect(allow(long([0x01, 8, sw(3), 6]))).toBe(true);
    expect(allow(long([0x01, 9, sw(2)]))).toBe(true);
    expect(allow(hp.frame(hp.SHORT, 0xff, 5, 2, [0]))).toBe(true);
  });

  it.each([
    ['a HID++ 1.0 register read (receiver firmware 0xF1)', [0xff, 0x81, 0xf1]],
    ['a HID++ 1.0 pairing register write', [0xff, 0x80, 0xb2, 1]],
    ['DFU, even though the device reported its index', [0x01, 10, sw(0)]],
    ['change host', [0x01, 11, sw(1), 1]],
    ['a feature index the device never reported', [0x01, 12, sw(0)]],
    ['setOnboardMode (a lasting change)', [0x01, 9, sw(1), 2]],
    ['an onboard-profile memory write', [0x01, 9, sw(6), 0, 0, 0, 0]],
    ['another software ID', [0x01, 5, 0x35, 0]],
    ['the notification software ID', [0x01, 5, 0x20, 0]],
    ['device index 7', [0x07, 0x00, sw(0), 0x22, 0x02]],
    ['a DPI range marker as a value', [0xff, 5, sw(3), 0, 0xe0, 0x32]],
    ['DPI 0', [0xff, 5, sw(3), 0, 0, 0]],
    ['sensor 1', [0xff, 5, sw(3), 1, 0x06, 0x40]],
    ['lift-off byte 4', [0x01, 6, sw(6), 0, 0x06, 0x40, 0x06, 0x40, 4]],
    ['report-rate code 7', [0x01, 8, sw(3), 7]],
    ['connection 2', [0x01, 8, sw(2), 2]],
    ['9 ms interval', [0x01, 7, sw(2), 9]],
    ['trailing bytes', [0x01, 7, sw(2), 8, 1]],
    ['an unlisted function (0x2202 fn 7)', [0x01, 6, sw(7), 0]],
  ])('refuses %s', (_name, bytes) => {
    expect(allow(long(bytes))).toBe(false);
  });

  it('refuses feature reports, other report IDs and wrong lengths', () => {
    const r = long([0x01, 0x00, sw(0), 0x00, 0x05]);
    expect(allow({ ...r, type: 'feature' })).toBe(false);
    expect(allow({ ...r, reportId: 0x12 })).toBe(false);
    expect(allow({ ...r, data: r.data.subarray(0, 7) })).toBe(false);
  });
});

describe('logitech-hidpp session (simulator, not hardware evidence)', () => {
  it('finds the mouse behind a Lightspeed receiver on Windows-style split interfaces', async () => {
    const { s } = session({ productId: LIGHTSPEED, roles: { 1: 'mouse' }, split: true, wirelessPid: 0x407f, usbPid: 0xc08d });
    expect(await s.connect()).toBe(1);
    const id = await s.identify();
    expect(id).toMatchObject({ deviceIndex: 1, name: 'G502 LIGHTSPEED', wired: false, protocol: { major: 4, minor: 2 } });
    expect(id.info).toMatchObject({ wirelessPid: 0x407f, usbPid: 0xc08d });
    expect(await s.battery()).toEqual({ percent: 82, state: 'discharging' });
    expect(await s.onboardMode()).toBe('onboard');
    expect(await s.dpiOptions()).toEqual(EXTENDED_DPI_OPTIONS);
    expect(await s.rateOptions(false)).toEqual([125, 250, 500, 1000, 2000, 4000, 8000]);
  });

  it('skips a keyboard G HUB merged onto slot 1 and finds the mouse on slot 2', async () => {
    const { s } = session({ productId: LIGHTSPEED, roles: { 1: 'keyboard', 2: 'mouse' } });
    expect(await s.connect()).toBe(2);
  });

  it('keeps probing past a sensorless direct endpoint (PRO X Superlight)', async () => {
    const { s } = session({ productId: G402, roles: { 0xff: 'keyboard', 0x01: 'mouse' } });
    expect(await s.connect()).toBe(1);
  });

  it('settles on a keyboard when nothing else answers, and says so when nothing answers', async () => {
    expect(await session({ productId: LIGHTSPEED, roles: { 3: 'keyboard' } }).s.connect()).toBe(3);
    await expect(session({ productId: LIGHTSPEED, roles: {} }).s.connect()).rejects.toThrow(/Nothing answered/);
  });

  it('writes DPI and report rate through the procedure and confirms only what the mouse reads back', async () => {
    const { sim, s } = session({ productId: LIGHTSPEED, roles: { 1: 'mouse' }, noise: true });
    await s.connect();
    const dpi = s.dpi((await s.dpiOptions())!);
    expect(await applySetting(dpi, 3200, 1600)).toEqual({ kind: 'confirmed', value: 3200 });
    expect(sim.lod).toBe(1); // lift-off written back as read
    const rate = s.reportRate((await s.rateOptions(false))!, false);
    expect(await applySetting(rate, 8000, 1000)).toEqual({ kind: 'confirmed', value: 8000 });
    expect(sim.rateHz).toBe(8000);
  });

  it('drives the legacy features on a wired G402 (device index FF)', async () => {
    const { sim, s } = session({ productId: G402, roles: { 0xff: 'mouse' }, legacy: true, usbPid: G402 });
    expect(await s.connect()).toBe(0xff);
    expect((await s.identify()).wired).toBe(true);
    expect(await s.dpiOptions()).toEqual(LEGACY_DPI_OPTIONS);
    expect(await s.rateOptions(true)).toEqual([125, 250, 500, 1000]);
    expect(await applySetting(s.reportRate([125, 250, 500, 1000], true), 500, 1000)).toEqual({ kind: 'confirmed', value: 500 });
    expect(sim.rateMs).toBe(2);
    expect(await applySetting(s.dpi(LEGACY_DPI_OPTIONS), 800, 1600)).toEqual({ kind: 'confirmed', value: 800 });
    expect(await s.battery()).toEqual({ percent: 60, state: 'discharging' });
  });

  it('reports a refused live write as failed, with the mouse’s reason and its value', async () => {
    const { s } = session({ productId: LIGHTSPEED, roles: { 1: 'mouse' }, rejectWrites: true });
    await s.connect();
    const result = await applySetting(s.reportRate((await s.rateOptions(false))!, false), 8000, 1000);
    expect(result).toMatchObject({ kind: 'failed', actual: 1000 });
    expect(result.kind === 'failed' && result.error).toMatch(/invalid argument/);
  });

  it('restores when the mouse ignores a write', async () => {
    const { s } = session({ productId: LIGHTSPEED, roles: { 1: 'mouse' }, ignoreWrites: true });
    await s.connect();
    expect(await applySetting(s.dpi((await s.dpiOptions())!), 3200, 1600)).toMatchObject({ kind: 'mismatch', actual: 1600, restoreConfirmed: true });
  });

  it('refuses unadvertised values before sending anything', async () => {
    const { sim, s } = session({ productId: LIGHTSPEED, roles: { 1: 'mouse' } });
    await s.connect();
    const dpi = s.dpi((await s.dpiOptions())!);
    const before = sim.sent.length;
    expect(await applySetting(dpi, 125, 1600)).toMatchObject({ kind: 'invalid' });
    expect(sim.sent.length).toBe(before);
  });

  it('cannot be talked into a denied collection', async () => {
    const sim = new HidppSim({ productId: LIGHTSPEED, roles: { 1: 'mouse' } });
    const s = new HidppSession(sim.interfaces, LIGHTSPEED, [{ usagePage: 0xff00, usage: 0x0002 }]);
    await expect(s.connect()).rejects.toBeInstanceOf(TransportRejected);
  });
});
