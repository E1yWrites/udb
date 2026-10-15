import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DPI_SENSORS, dpiOptions, packDpiStage, unpackDpiStage } from '../src/adapters/compx-dpi.ts';
import * as cx from '../src/adapters/compx.ts';
import { CompxSession } from '../src/adapters/compx-session.ts';
import { applySetting } from '../src/lib/write.ts';
import { CompxSim } from './compx-sim.ts';

const bytes = (hex: string) => Uint8Array.from(hex.split(' '), (h) => parseInt(h, 16));
const atk = JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures/openmouse-atk-x1-pro-max.json'), 'utf8')) as {
  frames: { tx: string; rx: string | null }[];
};
const PAW3950 = DPI_SENSORS.PAW3950!;
const X1 = DPI_SENSORS['pulsar x1']!;

describe('DPI codecs', () => {
  it('decodes and re-encodes the ATK X1 Pro Max rows from the OpenMouse capture (step50)', () => {
    expect(unpackDpiStage(PAW3950, bytes('0f 0f 00 37'))).toEqual({ x: 800, y: 800 });
    expect(unpackDpiStage(PAW3950, bytes('17 17 00 27'))).toEqual({ x: 1200, y: 1200 });
    expect(packDpiStage(PAW3950, 1250, 1250)).toEqual([0x18, 0x18, 0x00, 0x25]);
  });

  it('round-trips Pulsar X1 (ultra) values at every range edge', () => {
    for (const dpi of [10, 800, 10000, 10050, 30000, 30100, 32000]) {
      expect(unpackDpiStage(X1, packDpiStage(X1, dpi, dpi)!)).toEqual({ x: dpi, y: dpi });
    }
    // Pulsar's DPIex 0x22 above 10,000 and 0x33 above 30,000, per axis.
    expect(packDpiStage(X1, 20000, 20000)![2]).toBe(0x22);
    expect(packDpiStage(X1, 32000, 32000)![2]).toBe(0x33);
  });

  it('refuses values the sensor does not accept and rows with a bad checksum', () => {
    expect(packDpiStage(X1, 32100, 32100)).toBeNull();
    expect(packDpiStage(X1, 805, 805)).toBeNull();
    expect(packDpiStage(DPI_SENSORS.PAW3320!, 239, 238)).toEqual(expect.any(Array));
    expect(packDpiStage(DPI_SENSORS.PAW3320!, 240, 240)).toBeNull();
    expect(unpackDpiStage(PAW3950, bytes('0f 0f 00 38'))).toBeNull();
  });

  it('lists every option once, in order', () => {
    const opts = dpiOptions(X1);
    expect(opts[0]).toBe(10);
    expect(opts.at(-1)).toBe(32000);
    expect(new Set(opts).size).toBe(opts.length);
  });
});

describe('compx allowlist for DPI rows', () => {
  const allow = cx.allowFor(PAW3950);
  const write = (addr: number, row: number[]) => cx.writeFlash(addr, row);

  it('allows a canonical row on a stage address only when the sensor is known', () => {
    expect(allow(write(0x10, [0x18, 0x18, 0x00, 0x25]))).toBe(true);
    expect(cx.allow(write(0x10, [0x18, 0x18, 0x00, 0x25]))).toBe(false);
  });

  it.each([
    ['a bad row checksum', 0x10, [0x18, 0x18, 0x00, 0x26]],
    ['a value past the sensor maximum', 0x10, [0xff, 0xff, 0x0c, 0x55 - ((0xff + 0xff + 0x0c) & 0xff)]],
    ['a ninth stage', 0x0c + 4 * 8, [0x0f, 0x0f, 0x00, 0x37]],
    ['an unaligned address', 0x0e, [0x0f, 0x0f, 0x00, 0x37]],
  ])('refuses %s', (_name, addr, row) => {
    expect(allow(write(addr as number, (row as number[]).map((v) => v & 0xff)))).toBe(false);
  });
});

describe('ATK replay (OpenMouse capture, third-party hardware)', () => {
  it('UDB reproduces and allows every captured request, and decodes the replies', () => {
    const allow = cx.allowFor(PAW3950);
    for (const f of atk.frames) {
      const tx = bytes(f.tx);
      expect(tx[15]).toBe(cx.checksum(tx));
      expect(allow({ type: 'output', reportId: 8, data: tx })).toBe(true);
      if (f.rx) expect(cx.isResponse(tx, bytes(f.rx))).toBe(true);
    }
    expect(cx.decodeCidMid(bytes(atk.frames[0]!.rx!))).toEqual({ cid: 2, mid: 0x27 });
    expect(cx.readCidMid().data).toEqual(bytes(atk.frames[0]!.tx));
  });
});

describe('DPI stage write through the shared procedure (simulator)', () => {
  it('confirms only when both axes read back', async () => {
    const sim = new CompxSim();
    sim.flash.set([0x4f, 0x4f, 0x00, 0x55 - ((0x4f + 0x4f) & 0xff) & 0xff], 0x0c);
    const s = new CompxSession(sim, [], [], X1);
    await s.identify();
    const stage = s.dpiStage(0, X1);
    expect(await stage.read()).toEqual({ x: 800, y: 800 });
    expect(await applySetting(stage, { x: 1600, y: 1600 }, { x: 800, y: 800 })).toEqual({ kind: 'confirmed', value: { x: 1600, y: 1600 } });
    expect(await applySetting(stage, { x: 805, y: 805 }, { x: 1600, y: 1600 })).toMatchObject({ kind: 'invalid' });
  });
});
