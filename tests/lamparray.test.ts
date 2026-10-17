import { describe, expect, it } from 'vitest';
import * as la from '../src/adapters/lamparray.ts';
import { LampArraySession } from '../src/adapters/lamparray-session.ts';
import { sendSetting } from '../src/lib/write.ts';
import { TransportRejected, type OutgoingReport } from '../src/lib/transport.ts';
import { LampArraySim, lampArrayCollection } from './lamparray-sim.ts';

const layout = la.layoutOf(lampArrayCollection())!;
const feature = (reportId: number, ...bytes: number[]): OutgoingReport => ({ type: 'feature', reportId, data: Uint8Array.from(bytes) });

describe('lamparray layout (Microsoft reference descriptor, as WebHID reports it)', () => {
  it('finds each report and its size from the descriptor', () => {
    expect([layout.attributes, layout.request, layout.response, layout.range!, layout.control!].map((r) => [r.id, r.bytes])).toEqual([
      [1, 22],
      [2, 2],
      [3, 28],
      [5, 9],
      [6, 1],
    ]);
    // The reference descriptor lists update latency before lamp purposes.
    expect(layout.response.fields.map((f) => f.usage).slice(1, 6)).toEqual([la.U.x, la.U.y, la.U.z, la.U.latency, la.U.purposes]);
  });

  it('is null without the attribute reports, or for another collection', () => {
    const c = lampArrayCollection();
    c.children = c.children!.filter((x) => x.usage !== la.U.responseReport);
    expect(la.layoutOf(c)).toBeNull();
    expect(la.layoutOf({ usagePage: 0xff00, usage: 1 })).toBeNull();
  });

  it('encodes the update and control reports byte for byte', () => {
    expect([...la.lampRequest(layout, 0x0102).data]).toEqual([0x02, 0x01]);
    expect([...la.rangeUpdate(layout, 0, 97, { r: 255, g: 64, b: 0, i: 200 }).data]).toEqual([1, 0, 0, 97, 0, 255, 64, 0, 200]);
    expect([...la.control(layout, false).data]).toEqual([0]);
    expect([...la.control(layout, true).data]).toEqual([1]);
  });

  it('packs fields that are not byte-aligned, little-endian', () => {
    const l: la.ReportLayout = {
      id: 9,
      bytes: 2,
      fields: [
        { usage: 1, bit: 0, size: 4, max: 15, constant: false },
        { usage: 2, bit: 4, size: 12, max: 4095, constant: false },
      ],
    };
    const data = la.encode(l, { 1: [0xa], 2: [0x123] });
    expect([...data]).toEqual([0x3a, 0x12]);
    expect(la.decode(l, data)).toEqual(new Map([[1, [0xa]], [2, [0x123]]]));
  });

  it('decodes attribute replies with or without the leading report ID', async () => {
    const sim = new LampArraySim(98);
    const view = await sim.receiveFeatureReport(1);
    const withId = new Uint8Array(view.buffer);
    const expected = { lampCount: 98, size: { width: 370_000, height: 120_000, depth: 5_000 }, kind: 1, minUpdateIntervalUs: 10_000 };
    expect(la.decodeAttributes(layout, withId)).toEqual(expected);
    expect(la.decodeAttributes(layout, withId.subarray(1))).toEqual(expected);
  });
});

describe('lamparray allowlist', () => {
  const allow = la.allowFor(layout);

  it('allows attribute reads, lamp selection, range updates and the autonomous switch', () => {
    expect(allow({ type: 'feature-read', reportId: 1, data: new Uint8Array() })).toBe(true);
    expect(allow({ type: 'feature-read', reportId: 3, data: new Uint8Array() })).toBe(true);
    expect(allow(la.lampRequest(layout, 5))).toBe(true);
    expect(allow(la.rangeUpdate(layout, 0, 3, { r: 1, g: 2, b: 3, i: 255 }))).toBe(true);
    expect(allow(la.control(layout, true))).toBe(true);
  });

  it.each([
    ['a multi-lamp update', feature(4, 1, 1, ...new Array(48).fill(0))],
    ['autonomous mode 2', feature(6, 2)],
    ['a range that ends before it starts', feature(5, 1, 5, 0, 4, 0, 1, 2, 3, 4)],
    ['update flags 2', feature(5, 2, 0, 0, 3, 0, 1, 2, 3, 4)],
    ['a range update of the wrong length', feature(5, 1, 0, 0, 3, 0, 1, 2, 3)],
    ['a report ID outside the layout', feature(7, 0)],
  ])('refuses %s', (_name, r) => {
    expect(allow(r)).toBe(false);
  });

  it('refuses reading the update or control reports, and output reports', () => {
    for (const id of [2, 4, 5, 6]) expect(allow({ type: 'feature-read', reportId: id, data: new Uint8Array() })).toBe(false);
    expect(allow({ ...la.control(layout, true), type: 'output' })).toBe(false);
  });

  it('refuses stray bits in padding', () => {
    const padded: la.Layout = {
      ...layout,
      control: { id: 6, bytes: 1, fields: [{ usage: la.U.autonomous, bit: 0, size: 1, max: 1, constant: false }, { usage: -1, bit: 1, size: 7, max: 127, constant: true }] },
    };
    expect(la.allowFor(padded)(feature(6, 0x01))).toBe(true);
    expect(la.allowFor(padded)(feature(6, 0x81))).toBe(false);
  });
});

describe('lamparray session (simulator, not hardware evidence)', () => {
  const session = (sim: LampArraySim, deny = []) => new LampArraySession(sim, layout, deny);

  it('reads the array and every lamp', async () => {
    const sim = new LampArraySim(4);
    const s = session(sim);
    expect((await s.attributes()).lampCount).toBe(4);
    const lamps = await s.lamps(4);
    expect(lamps.map((l) => l.lampId)).toEqual([0, 1, 2, 3]);
    expect(lamps[2]).toMatchObject({ position: { x: 48_000, y: 20_000, z: 0 }, programmable: true, inputBinding: 0x06, levels: { red: 255, intensity: 1 } });
  });

  it('notices when the device answers a different lamp than asked', async () => {
    await expect(session(new LampArraySim(4)).lamp(10)).rejects.toThrow(/answered lamp 0/);
  });

  it('sends a colour to every lamp, says it was only sent, and hands control back', async () => {
    const sim = new LampArraySim(4);
    const s = session(sim);
    expect(await sendSetting(s.color(4), { r: 255, g: 0, b: 64, i: 255 })).toMatchObject({ kind: 'sent' });
    expect(sim.autonomous).toBe(false);
    expect(sim.colors).toEqual(new Array(4).fill([255, 0, 64, 255]));
    await s.release();
    expect(sim.autonomous).toBe(true);
  });

  it('validates before sending anything', async () => {
    const sim = new LampArraySim(4);
    expect(await sendSetting(session(sim).color(4), { r: 256, g: 0, b: 0, i: 0 })).toMatchObject({ kind: 'invalid' });
    expect(await sendSetting(session(sim).color(0), { r: 1, g: 0, b: 0, i: 0 })).toMatchObject({ kind: 'invalid' });
    expect(sim.sent).toHaveLength(0);
  });

  it('cannot be talked into a denied collection', async () => {
    const sim = new LampArraySim(4);
    await expect(new LampArraySession(sim, layout, [{ usagePage: la.PAGE, usage: la.U.lampArray }]).attributes()).rejects.toBeInstanceOf(TransportRejected);
  });
});
