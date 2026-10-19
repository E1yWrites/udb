import { describe, expect, it } from 'vitest';
import { rowWriter } from '../src/lib/commit.ts';
import { hexToHueSat, hueSatToHex } from '../src/lib/color.ts';

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('rowWriter', () => {
  it('runs one write at a time and ends on the newest value of a row', async () => {
    const requested: Record<string, number> = {};
    const log: string[] = [];
    let running = 0;
    const w = rowWriter<string>(async (row) => {
      running++;
      expect(running).toBe(1);
      log.push(`${row}=${requested[row]}`);
      await tick();
      running--;
    });
    requested.dpi = 400;
    w.commit('dpi');
    await Promise.resolve();
    // While 400 is being written, the slider passes 800 and stops at 1600.
    requested.dpi = 800;
    w.commit('dpi');
    requested.dpi = 1600;
    w.commit('dpi');
    requested.rate = 1000;
    void w.apply('rate');
    await new Promise((r) => setTimeout(r, 20));
    expect(log).toEqual(['dpi=400', 'dpi=1600', 'rate=1000']);
  });

  it('keeps going after a failed write', async () => {
    const seen: string[] = [];
    const w = rowWriter<string>(async (row) => {
      seen.push(row);
      if (row === 'a') throw new Error('boom');
    });
    await expect(w.apply('a')).rejects.toThrow('boom');
    await w.apply('b');
    expect(seen).toEqual(['a', 'b']);
  });
});

describe('colour', () => {
  it('converts the primaries and greys', () => {
    expect(hexToHueSat('#ff0000')).toEqual({ hue: 0, sat: 255 });
    expect(hexToHueSat('#00ff00')).toEqual({ hue: 85, sat: 255 });
    expect(hexToHueSat('#0000ff')).toEqual({ hue: 170, sat: 255 });
    expect(hexToHueSat('#ffffff')).toEqual({ hue: 0, sat: 0 });
    expect(hexToHueSat('#000000')).toEqual({ hue: 0, sat: 0 });
    expect(hexToHueSat('red')).toBeNull();
  });

  it('round-trips hue and saturation within one step', () => {
    for (const hue of [0, 21, 85, 128, 200, 254])
      for (const sat of [0, 100, 255]) {
        const back = hexToHueSat(hueSatToHex(hue, sat))!;
        expect(back.sat).toBeGreaterThanOrEqual(sat - 2);
        expect(back.sat).toBeLessThanOrEqual(sat + 2);
        if (sat > 50) expect(Math.min(Math.abs(back.hue - hue), 256 - Math.abs(back.hue - hue))).toBeLessThanOrEqual(2);
      }
  });
});
