import { describe, expect, it } from 'vitest';
import * as cx from '../src/adapters/corsair-nxp.ts';
import { CorsairNxpSession } from '../src/adapters/corsair-nxp-session.ts';
import { applySetting } from '../src/lib/write.ts';
import { TransportRejected, type OutgoingReport } from '../src/lib/transport.ts';
import { CorsairNxpSim } from './corsair-nxp-sim.ts';
import fx from './fixtures/openmouse-corsair-nightsword-2026-09.json';

const bytes = (hex: string) => {
  const b = new Uint8Array(cx.SIZE);
  b.set(hex.split(' ').map((h) => parseInt(h, 16)));
  return b;
};
const report = (hex: string): OutgoingReport => ({ type: 'feature', reportId: 0, data: bytes(hex) });

describe('corsair-nxp replies (OpenMouse, NIGHTSWORD RGB fw 3.41)', () => {
  it('decodes identity, little-endian', () => {
    expect(cx.decodeIdent(bytes(fx.replies.ident))).toEqual({ firmware: '3.41', bootloader: '3.08', vendorId: 0x1b1c, productId: 0x1b5c, pollingRateHz: 1000 });
  });

  it('decodes the stage state, DPI big-endian on GET', () => {
    expect(cx.decodeByte(bytes(fx.replies.mask))).toBe(0x0f);
    expect(cx.enabledStages(0x0f)).toEqual([0, 1, 2, 3]);
    expect(cx.decodeCurrent(bytes(fx.replies.current))).toEqual({ stage: 2, x: 2400, y: 2400 });
    expect(cx.decodeByte(bytes(fx.replies.lift))).toBe(5);
    expect(fx.stagesIcue.map((h) => cx.decodeStage(bytes(h))?.x)).toEqual([400, 800, 2400, 5700, 0, 0]);
    expect(fx.stagesFactory.map((h) => cx.decodeStage(bytes(h))?.x)).toEqual([800, 1500, 3000, 6000, 0, 0]);
    expect(cx.decodeStage(bytes(fx.stagesIcue[0]!))?.rgb).toEqual([0xff, 0xff, 0]);
  });

  it('builds the GETs whose replies echo them', () => {
    expect(cx.isEcho(cx.ident().data, bytes(fx.replies.ident))).toBe(true);
    expect(cx.isEcho(cx.getMouse(cx.MOUSE.dpi).data, bytes(fx.replies.current))).toBe(true);
    for (let n = 0; n < 6; n++) expect(cx.isEcho(cx.getStage(n).data, bytes(fx.stagesFactory[n]!))).toBe(true);
    expect(cx.isEcho(cx.getStage(3).data, bytes(fx.stagesFactory[2]!))).toBe(false); // a stale d2 buffer for a d3 read
  });

  it('encodes the SETs OpenMouse sent in its write probe, and accepts them', () => {
    const ours: Record<string, OutgoingReport> = {
      '07 13 02 00 01': cx.setActiveStage(1),
      '07 13 02 00 02': cx.setActiveStage(2),
      '07 13 04 00 00': cx.setSnap(false),
      '07 13 03 00 01': cx.setLift(1),
      '07 13 03 00 03': cx.setLift(3),
      '07 13 03 00 05': cx.setLift(5),
    };
    for (const step of fx.writeProbe) {
      expect(cx.allow(report(step.set))).toBe(true);
      if (ours[step.set]) expect(ours[step.set]!.data).toEqual(bytes(step.set));
    }
  });

  it('writes DPI little-endian and keeps the stage colour', () => {
    expect([...cx.setStageDpi(2, 800, [0, 0xbf, 0xff]).data.subarray(0, 12)]).toEqual([0x07, 0x13, 0xd2, 0, 0, 0x20, 0x03, 0x20, 0x03, 0, 0xbf, 0xff]);
  });
});

describe('corsair-nxp allowlist', () => {
  it.each([
    ['the polling write (the mouse re-enumerates)', '07 0a 00 00 01'],
    ['the stage mask write (not yet sent to hardware)', '07 13 05 00 07'],
    ['a stored-profile read', '0e 13 02 01'],
    ['a stored-profile write', '07 13 02 01 01'],
    ['the profile name', '07 16 00 00 41'],
    ['the hardware profile format', '07 17 00 00 01'],
    ['the bulk profile field', '07 ff 00 00'],
    ['lift height 6', '07 13 03 00 06'],
    ['lift height 0', '07 13 03 00 00'],
    ['angle snap 2', '07 13 04 00 02'],
    ['stage 6', '07 13 02 00 06'],
    ['independent X/Y', '07 13 d1 00 01 20 03 40 06 00 bf ff'],
    ['DPI below 100', '07 13 d1 00 00 32 00 32 00 00 bf ff'],
    ['trailing bytes on a GET', '0e 13 02 00 01'],
    ['an unknown subcommand', '0e 13 06 00'],
  ])('refuses %s', (_name, hex) => {
    expect(cx.allow(report(hex))).toBe(false);
  });
});

describe('corsair-nxp session (simulator, not hardware evidence)', () => {
  const session = (sim = new CorsairNxpSim()) => ({ sim, s: new CorsairNxpSession(sim, [], [], 1) });

  it('reads identity and stages', async () => {
    const { s } = session();
    expect((await s.ident())?.firmware).toBe('3.41');
    expect(await s.mask()).toBe(0x0f);
    expect(await s.stage(3)).toEqual({ x: 6000, y: 6000, rgb: [0, 0xbf, 0xff] });
  });

  it('writes live settings, confirms them by reading back, and keeps stage colours', async () => {
    const { sim, s } = session();
    const enabled = [0, 1, 2, 3];
    expect(await applySetting(s.activeStage(enabled), 2, 1)).toEqual({ kind: 'confirmed', value: 2 });
    expect(await applySetting(s.stageDpi(2, enabled, { min: 100, max: 18000 }), 3200, 3000)).toEqual({ kind: 'confirmed', value: 3200 });
    expect(sim.stages[2]!.rgb).toEqual([0, 0xbf, 0xff]);
    expect(await applySetting(s.lift(), 3, 5)).toEqual({ kind: 'confirmed', value: 3 });
    expect(await applySetting(s.snap(), 1, 0)).toEqual({ kind: 'confirmed', value: 1 });
  });

  it('is honest that live settings do not survive a power cycle', async () => {
    const { sim, s } = session();
    await applySetting(s.lift(), 2, 5);
    sim.powerCycle();
    expect(await s.lift().read()).toBe(5);
  });

  it('refuses a stage the mask does not enable (the mouse would ignore it)', async () => {
    const { sim, s } = session();
    const before = sim.sent.length;
    expect(await applySetting(s.stageDpi(4, [0, 1, 2, 3], { min: 100, max: 18000 }), 1600, 0)).toMatchObject({ kind: 'invalid' });
    expect(await applySetting(s.activeStage([0, 1, 2, 3]), 5, 1)).toMatchObject({ kind: 'invalid' });
    expect(sim.sent.length).toBe(before);
  });

  it('skips a stale buffer by its echo', async () => {
    const { sim, s } = session();
    await s.stage(2);
    const realSend = sim.sendFeatureReport.bind(sim);
    let first = true;
    sim.sendFeatureReport = async (id: number, data: BufferSource) => {
      if (first) {
        first = false;
        sim.sent.push([...new Uint8Array(data as ArrayBuffer)]);
        return; // the mouse drops the first request: the buffer still holds d2
      }
      return realSend(id, data);
    };
    expect(await s.stage(3)).toEqual({ x: 6000, y: 6000, rgb: [0, 0xbf, 0xff] });
  });

  it('cannot be talked into a denied collection', async () => {
    const sim = new CorsairNxpSim();
    await expect(new CorsairNxpSession(sim, [{ usagePage: 0xffc2, usage: 0x0004 }], [], 1).ident()).rejects.toBeInstanceOf(TransportRejected);
  });
});
