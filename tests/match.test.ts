import { describe, expect, it } from 'vitest';
import { registry } from '../src/lib/registry.ts';
import { chooserFilters, matchDevice, resolveByProtocolIdentity } from '../src/lib/match.ts';

describe('matchDevice', () => {
  it('matches the Pulsar dongle but leaves the model unconfirmed until CID/MID is read', () => {
    const m = matchDevice({ vendorId: 0x3710, productId: 0x5406, productName: 'Pulsar 8K Dongle' }, registry);
    expect(m?.entry.id).toBe('pulsar/x2-crazylight');
    expect(m?.modelConfirmed).toBe(false);
  });

  it('confirms the CrazyLight on its cable from the USB product string, a PID Pulsar shares across models', () => {
    const m = matchDevice({ vendorId: 0x3710, productId: 0x3414, productName: 'Pulsar X2 CrazyLight' }, registry);
    expect(m?.entry.id).toBe('pulsar/x2-crazylight');
    expect(m?.identity.connection).toBe('wired');
    expect(m?.modelConfirmed).toBe(true);
    expect(matchDevice({ vendorId: 0x3710, productId: 0x3414, productName: 'Pulsar Xlite V4' }, registry)).toBeNull();
  });

  it('matches the Vibe75 on its borrowed Apple VID/PID only by product name', () => {
    const vibe = matchDevice({ vendorId: 0x05ac, productId: 0x024f, productName: 'Mechlands Vibe75' }, registry);
    expect(vibe?.entry.id).toBe('mechlands/vibe75');
    expect(vibe?.identity.connection).toBe('wired');
    expect(vibe?.modelConfirmed).toBe(true);
    const apple = matchDevice({ vendorId: 0x05ac, productId: 0x024f, productName: 'Apple Keyboard' }, registry);
    expect(apple).toBeNull();
  });

  it('matches any keyboard exposing the VIA collection to the generic QMK/VIA entry, model unconfirmed', () => {
    const q2 = { vendorId: 0x3434, productId: 0x0111, productName: 'Keychron Q2' };
    const m = matchDevice({ ...q2, collections: [{ usagePage: 0xff60, usage: 0x0061 }] }, registry);
    expect(m?.entry.id).toBe('qmk/via-keyboard');
    expect(m?.modelConfirmed).toBe(false);
    expect(matchDevice({ ...q2, collections: [{ usagePage: 0xff60, usage: 0x0062 }] }, registry)).toBeNull();
    expect(matchDevice(q2, registry)).toBeNull();
  });

  it('prefers an entry with the device’s own VID/PID over a collection match', () => {
    const dongle = { vendorId: 0x3710, productId: 0x5406, productName: 'Pulsar 8K Dongle' };
    expect(matchDevice({ ...dongle, collections: [{ usagePage: 0xff60, usage: 0x0061 }] }, registry)?.entry.id).toBe('pulsar/x2-crazylight');
  });

  it('matches Logitech wired mice by VID/PID, and receivers and unknown models to the HID++ entry', () => {
    const hidpp = [{ usagePage: 0xff00, usage: 0x0002 }];
    expect(matchDevice({ vendorId: 0x046d, productId: 0xc08b, productName: 'G502 HERO Gaming Mouse', collections: hidpp }, registry)).toMatchObject({
      entry: { id: 'logitech/g502-hero' },
      modelConfirmed: true,
    });
    const receiver = matchDevice({ vendorId: 0x046d, productId: 0xc539, productName: 'USB Receiver', collections: hidpp }, registry);
    expect(receiver).toMatchObject({ entry: { id: 'logitech/hidpp-device' }, modelConfirmed: false });
    expect(matchDevice({ vendorId: 0x046d, productId: 0xc539, productName: 'USB Receiver', collections: [{ usagePage: 0x0001, usage: 0x0002 }] }, registry)).toBeNull();
    expect(matchDevice({ vendorId: 0x1234, productId: 0xc539, productName: 'x', collections: hidpp }, registry)).toBeNull();
  });

  it('finds the model behind a receiver from the wireless PID it reports', () => {
    expect(matchDevice({ vendorId: 0x046d, productId: 0x407f, productName: '' }, registry)?.entry.id).toBe('logitech/g502-hero-wireless');
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
    expect(filters).toContainEqual({ usagePage: 0xff60, usage: 0x0061 });
    expect(filters).toContainEqual({ vendorId: 0x046d, usagePage: 0xff00, usage: 0x0002 });
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

describe('shared receiver IDs', () => {
  it('resolves an ATK receiver ID shared by several models through the reported CID/MID', () => {
    const shared = registry.flatMap((e) => e.identities.map((id) => `${id.vid}:${id.pid}`));
    const dupe = shared.find((k, i) => shared.indexOf(k) !== i)!;
    const [vid, pid] = dupe.split(':').map((h) => parseInt(h, 16));
    const dev = { vendorId: vid!, productId: pid!, productName: 'receiver' };
    expect(matchDevice(dev, registry)?.modelConfirmed).toBe(false);
    const owners = registry.filter((e) => e.identities.some((id) => `${id.vid}:${id.pid}` === dupe));
    const target = owners[1]!.identities.find((id) => `${id.vid}:${id.pid}` === dupe)!.protocolIdentity!;
    const resolved = resolveByProtocolIdentity(dev, registry, { cid: target.cid!, mid: target.mid! });
    expect(resolved?.entry.id).toBe(owners[1]!.id);
  });

  it('confirms the owner CrazyLight from MID 82', () => {
    const r = resolveByProtocolIdentity({ vendorId: 0x3710, productId: 0x5406, productName: 'Pulsar 8K Dongle' }, registry, { cid: 87, mid: 82 });
    expect(r?.entry.id).toBe('pulsar/x2-crazylight');
  });

  it('recognises a detection-only Aura keyboard and keeps the G14 on its own entry', () => {
    const scope = matchDevice({ vendorId: 0x0b05, productId: 0x190c, productName: 'ROG STRIX SCOPE TKL' }, registry);
    expect(scope?.entry.id).toBe('asus/rog-strix-scope-tkl');
    expect(scope?.entry.collections.use).toEqual([]);
    const g14 = matchDevice({ vendorId: 0x0b05, productId: 0x19b6, productName: 'ITE Device(8910)' }, registry);
    expect(g14?.entry.id).toBe('asus/rog-zephyrus-g14-ga403-keyboard');
  });

  it('recognises a detection-only SteelSeries mouse on the cable and on the dongle', () => {
    const cable = matchDevice({ vendorId: 0x1038, productId: 0x183a, productName: 'SteelSeries Aerox 3 Wireless' }, registry);
    const dongle = matchDevice({ vendorId: 0x1038, productId: 0x1838, productName: 'SteelSeries Aerox 3 Wireless' }, registry);
    expect(cable?.entry.id).toBe('steelseries/aerox-3-wireless');
    expect(dongle?.entry.id).toBe('steelseries/aerox-3-wireless');
    expect(cable?.entry.collections.use).toEqual([]);
  });
});
