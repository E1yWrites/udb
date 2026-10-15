import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as rz from '../src/adapters/razer.ts';
import { paramsFrom, RazerSession, type Params } from '../src/adapters/razer-session.ts';
import { applySetting } from '../src/lib/write.ts';
import { TransportRejected, type OutgoingReport } from '../src/lib/transport.ts';
import { RazerSim, type RazerSimOptions } from './razer-sim.ts';

/** Set/get pairs from an OpenMouse capture. Redacted bytes (`xx`) become null. */
function capture(name: string) {
  const lines = readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('set report') || l.startsWith('get report'));
  const bytes = (l: string) => l.split(/\s+/).slice(3).map((h) => (h === 'xx' ? null : parseInt(h, 16)));
  const pairs: { req: Uint8Array<ArrayBuffer>; res: (number | null)[] }[] = [];
  for (let i = 0; i + 1 < lines.length; i += 2) {
    expect(lines[i]).toMatch(/^set report/);
    expect(lines[i + 1]).toMatch(/^get report/);
    pairs.push({ req: Uint8Array.from(bytes(lines[i]!) as number[]), res: bytes(lines[i + 1]!) });
  }
  return pairs;
}

const commandOf = (b: Uint8Array): rz.Command => ({ cls: b[6]!, id: b[7]!, size: b[5]!, args: Array.from(b.subarray(8, 8 + b[5]!)) });
const feature = (data: Uint8Array<ArrayBuffer>): OutgoingReport => ({ type: 'feature', reportId: 0, data });

describe.each([
  ['receiver (1532:00B7)', 'openmouse-razer-deathadder-v3-pro-receiver-2026-09-15.hex'],
  ['cable (1532:00B6)', 'openmouse-razer-deathadder-v3-pro-wired-2026-09-15.hex'],
])('razer replay: DeathAdder V3 Pro over the %s, OpenMouse 2026-09-15', (_link, file) => {
  const pairs = capture(file);
  const serial = (p: (typeof pairs)[number]) => p.req[6] === 0x00 && p.req[7] === 0x82;

  it('has every report of the session, all answered ok', () => {
    expect(pairs).toHaveLength(243);
    for (const { res } of pairs) expect(res[0]).toBe(rz.STATUS.ok);
  });

  it('checksums every request and every unredacted reply like UDB does', () => {
    for (const { req, res } of pairs) {
      expect(req[88]).toBe(rz.checksum(req));
      if (!res.includes(null)) expect(res[88]).toBe(rz.checksum(Uint8Array.from(res as number[])));
    }
  });

  it('allows every command OpenMouse sent except the serial read, which UDB refuses', () => {
    for (const p of pairs) expect(rz.allow(feature(p.req))).toBe(!serial(p));
  });

  it('encodes the same bytes for the commands it allows', () => {
    for (const p of pairs.filter((x) => !serial(x))) expect(rz.encode(commandOf(p.req), 0x1f).data).toEqual(p.req);
  });

  it('decodes the replies to the values OpenMouse recorded', () => {
    const replies = pairs.filter((p) => !serial(p)).map((p) => ({ c: commandOf(p.req), args: rz.decode(Uint8Array.from(p.res as number[]), commandOf(p.req)) }));
    const first = (cls: number, id: number) => replies.find((r) => r.c.cls === cls && r.c.id === id)!.args;
    expect(rz.decodeFirmware(first(0x00, 0x81))).toBe('2.1');
    expect(rz.decodeDpi(first(0x04, 0x85))).toEqual({ x: 1600, y: 1600 });
    expect(rz.decodePolling(first(0x00, 0x85))).toBe(1000);
    expect(rz.decodeSleep(first(0x07, 0x83))).toBe(300);
    expect(rz.decodeLowPower(first(0x07, 0x81))).toBe(30);
    expect(rz.decodeBattery(first(0x07, 0x80))).toBeGreaterThanOrEqual(25);
    // The session's writes: DPI 800, 3200, 1600 and polling 125, 500, 1000 Hz.
    const writes = (cls: number, id: number) => replies.filter((r) => r.c.cls === cls && r.c.id === id).map((r) => r.c.args!);
    expect(writes(0x04, 0x05).map((a) => (a[1]! << 8) | a[2]!)).toEqual([800, 3200, 1600]);
    expect(writes(0x00, 0x05).map((a) => 1000 / a[0]!)).toEqual([125, 500, 1000]);
  });
});

describe('razer allowlist', () => {
  const ok = (c: rz.Command, txn = 0x1f) => rz.allow(rz.encode(c, txn));

  it('accepts the documented commands on the three transaction IDs', () => {
    for (const txn of rz.TRANSACTION_IDS) expect(ok(rz.READ.firmware, txn)).toBe(true);
    expect(ok(rz.setDpi(0, 45000))).toBe(true);
    expect(ok(rz.setSleep(900))).toBe(true);
    expect(ok(rz.setLowPower(5))).toBe(true);
    expect(ok(rz.setPolling(125))).toBe(true);
    expect(ok(rz.setPollingExtended(8000, 1))).toBe(true);
    expect(rz.allow({ type: 'feature-read', reportId: 0, data: new Uint8Array() })).toBe(true);
  });

  it.each([
    ['the serial read', { cls: 0x00, id: 0x82, size: 0x16 }],
    ['device mode (driver mode)', { cls: 0x00, id: 0x04, size: 2, args: [3, 0] }],
    ['the DPI stage table write', { cls: 0x04, id: 0x06, size: 0x26, args: [1, 1, 1] }],
    ['a lift-off write', { cls: 0x0b, id: 0x05, size: 0x0a }],
    ['a button mapping write', { cls: 0x02, id: 0x0c, size: 0x0a, args: [1] }],
    ['a lighting effect', { cls: 0x0f, id: 0x02, size: 9 }],
    ['DPI below 100', rz.setDpi(1, 50)],
    ['storage byte 2', { ...rz.setDpi(1, 800), args: [2, 3, 0x20, 3, 0x20, 0, 0] }],
    ['sleep of 30 s', rz.setSleep(30)],
    ['250 Hz on the legacy command', { cls: 0x00, id: 0x05, size: 1, args: [4] }],
    ['an extended polling selector of 2', { cls: 0x00, id: 0x40, size: 2, args: [2, 1] }],
    ['a get with arguments', { ...rz.READ.battery, args: [1] }],
    ['the right command with the wrong size', { ...rz.READ.firmware, size: 3 }],
  ])('refuses %s', (_name, c) => {
    expect(ok(c as rz.Command)).toBe(false);
  });

  it('refuses unknown transaction IDs, bad checksums and non-zero padding', () => {
    expect(ok(rz.READ.firmware, 0x10)).toBe(false);
    const r = rz.encode(rz.READ.firmware, 0x1f);
    expect(rz.allow({ ...r, data: Uint8Array.from(r.data, (v, i) => (i === 88 ? v ^ 1 : v)) })).toBe(false);
    expect(rz.allow({ ...r, data: Uint8Array.from(r.data, (v, i) => (i === 89 ? 1 : v)) })).toBe(false);
    expect(rz.allow({ ...r, type: 'output' })).toBe(false);
  });
});

const PARAMS: Params = { transactionId: 0x1f, polling: 'legacy', pollingRates: [125, 500, 1000], dpiStorage: 1, maxDpi: 30000, battery: true, wireless: true };
const UNDECLARED = { deny: [], undeclared: [{ usagePage: 0x0001, usage: 0x0002, reportId: 0 }] };
const session = (opts: RazerSimOptions = {}, params: Partial<Params> = {}) => {
  const sim = new RazerSim(opts);
  return { sim, s: new RazerSession(sim, UNDECLARED, { ...PARAMS, ...params }, [], 1) };
};

describe('razer session (simulator, not hardware evidence)', () => {
  it('reads firmware, battery and settings', async () => {
    const { s } = session();
    expect(await s.firmware()).toBe('2.1');
    expect(await s.battery()).toEqual({ percent: 26, charging: true });
    expect(await s.dpi().read()).toBe(1600);
    expect(await s.readPolling()).toBe(1000);
    expect(await s.sleepTimeout().read()).toBe(300);
    expect(await s.lowPower().read()).toBe(30);
  });

  it('is refused by the transport without the registry’s undeclared-report exception', async () => {
    const sim = new RazerSim();
    await expect(new RazerSession(sim, { deny: [] }, PARAMS, [], 1).firmware()).rejects.toBeInstanceOf(TransportRejected);
    expect(sim.sent).toHaveLength(0);
  });

  it('writes through the procedure and confirms only what the mouse reads back', async () => {
    const { sim, s } = session();
    expect(await applySetting(s.dpi(), 3200, 1600)).toEqual({ kind: 'confirmed', value: 3200 });
    expect(await applySetting(s.polling(), 125, 1000)).toEqual({ kind: 'confirmed', value: 125 });
    expect(await applySetting(s.sleepTimeout(), 600, 300)).toEqual({ kind: 'confirmed', value: 600 });
    expect(await applySetting(s.lowPower(), 15, 30)).toEqual({ kind: 'confirmed', value: 15 });
    expect([sim.dpi, sim.divisor, sim.sleep]).toEqual([3200, 8, 600]);
  });

  it('commits extended polling with a second write on its own transaction ID', async () => {
    const { sim, s } = session({ extended: true, transactionId: 0x1f }, { polling: 'extended', pollingRates: [125, 500, 1000, 2000, 4000, 8000], pollingCommitTransactionId: 0x1f });
    expect(await applySetting(s.polling(), 8000, 1000)).toEqual({ kind: 'confirmed', value: 8000 });
    const writes = sim.sent.filter((b) => b[6] === 0x00 && b[7] === 0x40).map((b) => [b[1], b[8], b[9]]);
    expect(writes).toEqual([
      [0x1f, 0, 1],
      [0x1f, 1, 1],
    ]);
  });

  it('refuses low power above 1000 Hz, as Synapse does', async () => {
    const { s } = session({ extended: true }, { polling: 'extended', pollingRates: [1000, 8000] });
    await applySetting(s.polling(), 8000, 1000);
    expect(await applySetting(s.lowPower(), 15, 30)).toMatchObject({ kind: 'failed', actual: 30 });
  });

  it('waits out busy replies and resends after a corrupt one', async () => {
    expect(await session({ busy: 3 }).s.firmware()).toBe('2.1');
    const { sim, s } = session({ corruptFirst: true });
    expect(await s.firmware()).toBe('2.1');
    expect(sim.sent).toHaveLength(2);
  });

  it('reports a missing charging state as unknown, not as a failed battery read', async () => {
    expect(await session({ noCharging: true }).s.battery()).toEqual({ percent: 26, charging: null });
  });

  it('fails without writing anything when the transaction ID is wrong', async () => {
    const { sim, s } = session({ transactionId: 0x3f });
    await expect(s.firmware()).rejects.toThrow(/status 00/);
    expect(sim.sent).toHaveLength(1);
  });

  it('restores when the mouse ignores a write, and validates before sending', async () => {
    const { sim, s } = session({ ignoreWrites: true });
    expect(await applySetting(s.dpi(), 3200, 1600)).toMatchObject({ kind: 'mismatch', actual: 1600, restoreConfirmed: true });
    const before = sim.sent.length;
    expect(await applySetting(s.dpi(), 31000, 1600)).toMatchObject({ kind: 'invalid' });
    expect(await applySetting(s.sleepTimeout(), 90, 300)).toMatchObject({ kind: 'invalid' });
    expect(await applySetting(s.lowPower(), 12, 30)).toMatchObject({ kind: 'invalid' });
    expect(sim.sent.length).toBe(before);
  });

  it('reads registry params and rejects malformed ones', () => {
    expect(paramsFrom({ transactionId: 31, polling: 'legacy', pollingRates: [125, 500, 1000], dpiStorage: 1, maxDpi: 30000, battery: true, wireless: true })).toEqual(PARAMS);
    expect(paramsFrom({ transactionId: 31, polling: 'fast', pollingRates: [], dpiStorage: 1, maxDpi: 1 })).toBeNull();
    expect(paramsFrom(undefined)).toBeNull();
  });
});
