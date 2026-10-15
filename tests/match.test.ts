import { describe, expect, it } from 'vitest';
import { registry } from '../src/lib/registry.ts';
import { chooserFilters, matchDevice } from '../src/lib/match.ts';

describe('matchDevice', () => {
  it('matches the Pulsar dongle but leaves the model unconfirmed until CID/MID is read', () => {
    const m = matchDevice({ vendorId: 0x3710, productId: 0x5406, productName: 'Pulsar 8K Dongle' }, registry);
    expect(m?.entry.id).toBe('pulsar/x2-crazylight');
    expect(m?.modelConfirmed).toBe(false);
  });

  it('matches the Vibe75 on its borrowed Apple VID/PID only by product name', () => {
    const vibe = matchDevice({ vendorId: 0x05ac, productId: 0x024f, productName: 'Mechlands Vibe75' }, registry);
    expect(vibe?.entry.id).toBe('mechlands/vibe75');
    expect(vibe?.identity.connection).toBe('wired');
    expect(vibe?.modelConfirmed).toBe(true);
    const apple = matchDevice({ vendorId: 0x05ac, productId: 0x024f, productName: 'Apple Keyboard' }, registry);
    expect(apple).toBeNull();
  });

  it('returns null for unknown devices', () => {
    expect(matchDevice({ vendorId: 0x1234, productId: 0x5678, productName: 'x' }, registry)).toBeNull();
  });
});

describe('chooserFilters', () => {
  const filters = chooserFilters(registry);

  it('requests only collections an adapter uses', () => {
    expect(filters).toContainEqual({ vendorId: 0x3710, productId: 0x5406, usagePage: 0xff02, usage: 0x0002 });
    expect(filters).toContainEqual({ vendorId: 0x05ac, productId: 0x024f, usagePage: 0xff13, usage: 0x0001 });
  });

  it('never requests a denied collection', () => {
    const denied = registry.flatMap((e) => e.collections.deny.map((c) => parseInt(c.usagePage, 16)));
    expect(denied.length).toBeGreaterThan(0);
    expect(filters.filter((f) => denied.includes(f.usagePage!))).toEqual([]);
  });

  it('has no duplicate filters', () => {
    expect(new Set(filters.map((f) => JSON.stringify(f))).size).toBe(filters.length);
  });
});
