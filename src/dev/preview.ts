// Fake devices for design review (`npm run dev`, then /?preview or /?preview=empty).
// Collections mirror the dev machine's real descriptors (HidP_GetCaps, 2026-10-15).
import { devices, keyOf, type Presence } from '../lib/devices.svelte.ts';
import { matchDevice } from '../lib/match.ts';
import { registry } from '../lib/registry.ts';
import { CompxSim } from '../../tests/compx-sim.ts';
import { ViaSim } from '../../tests/qmk-via-sim.ts';
import { HidppSim } from '../../tests/logitech-hidpp-sim.ts';
import { RazerSim } from '../../tests/razer-sim.ts';

const rep = (id: number, bytes: number) => [{ reportId: id, items: [{ reportSize: 8, reportCount: bytes }] }];

function fake(vendorId: number, productId: number, productName: string, collections: HIDCollectionInfo[]): HIDDevice {
  return { vendorId, productId, productName, collections, opened: false } as unknown as HIDDevice;
}

// The Pulsar answers through the protocol simulator (tests/compx-sim.ts), so the live panel works in preview.
const pulsar = Object.assign(new CompxSim({ mid: 82, type: 5 }), {
  vendorId: 0x3710,
  productId: 0x5406,
  productName: 'Pulsar 8K Dongle',
  open: async () => {},
  close: async () => {},
}) as unknown as HIDDevice;
// A VIA keyboard (Keychron Q2 IDs) answering through tests/qmk-via-sim.ts.
const keychron = Object.assign(new ViaSim({ channels: { rgbMatrix: { max: 200 } } }), {
  vendorId: 0x3434,
  productId: 0x0111,
  productName: 'Keychron Q2',
  open: async () => {},
  close: async () => {},
}) as unknown as HIDDevice;
// A Lightspeed receiver with a G502 LIGHTSPEED on slot 1, one HIDDevice per collection as on Windows.
const lightspeed = new HidppSim({ productId: 0xc539, roles: { 1: 'mouse' }, split: true, wirelessPid: 0x407f, usbPid: 0xc08d }).interfaces.map(
  (i) => Object.assign(i, { vendorId: 0x046d, productId: 0xc539, productName: 'USB Receiver' }) as unknown as HIDDevice,
);
// A DeathAdder V3 Pro on its HyperSpeed receiver, answering through tests/razer-sim.ts.
const razer = Object.assign(new RazerSim(), {
  vendorId: 0x1532,
  productId: 0x00b7,
  productName: 'Razer DeathAdder V3 Pro',
  open: async () => {},
  close: async () => {},
}) as unknown as HIDDevice;
// A G933 on its own wireless dongle (HID++ index FF), answering through tests/logitech-hidpp-sim.ts.
const g933 = new HidppSim({ productId: 0x0a5b, roles: { 0xff: 'headset' } }).interfaces.map(
  (i) => Object.assign(i, { vendorId: 0x046d, productId: 0x0a5b, productName: 'G933 Gaming Headset' }) as unknown as HIDDevice,
);
const vibe = fake(0x05ac, 0x024f, 'Mechlands Vibe75', [
  { usagePage: 0xff13, usage: 0x0001, inputReports: rep(0, 64), outputReports: rep(0, 64), featureReports: rep(0, 64) },
]);
const g14 = fake(0x0b05, 0x19b6, 'ITE Device(8910)', [
  { usagePage: 0xff31, usage: 0x0079, inputReports: rep(0x5d, 32), outputReports: rep(0x5d, 127), featureReports: rep(0x5d, 127) },
  { usagePage: 0xff82, usage: 0x00cf, inputReports: rep(0x5a, 16), outputReports: rep(0x5a, 60), featureReports: rep(0x5a, 60) },
  { usagePage: 0x0059, usage: 0x0001, featureReports: rep(1, 50) },
]);
const vxe = fake(0x25a7, 0xfa6c, 'VXE R1 SE+', [{ usagePage: 0xff00, usage: 0x0001, featureReports: rep(5, 32) }]);

const SETS: Record<string, [HIDDevice | HIDDevice[], Presence][]> = {
  preview: [[pulsar, 'connected'], [lightspeed, 'connected'], [razer, 'connected'], [g933, 'connected'], [vibe, 'connected'], [keychron, 'connected'], [g14, 'connected'], [vxe, 'connected']],
  busy: [[vibe, 'busy'], [pulsar, 'disconnected']],
};

export function load(search: string): void {
  const name = new URLSearchParams(search).get('preview') || 'preview';
  if (name === 'cancelled') devices.outcome = { kind: 'cancelled' };
  for (const [set, presence] of SETS[name] ?? []) {
    const hids = [set].flat();
    const hid = hids[0]!;
    devices.list.push({
      key: keyOf(hid),
      vendorId: hid.vendorId,
      productId: hid.productId,
      productName: hid.productName,
      interfaces: presence === 'disconnected' ? [] : hids,
      match: matchDevice(hid, registry),
      presence,
      reconnects: 0,
      openError: presence === 'busy' ? 'NotAllowedError: Failed to open the device.' : undefined,
    });
  }
}
