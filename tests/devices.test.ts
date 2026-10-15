import { expect, it } from 'vitest';
import { Devices } from '../src/lib/devices.svelte.ts';

// A Vibe75 without a USB serial: after unplugging, Chromium drops the grant, so
// the replugged keyboard arrives through requestDevice as a new HIDDevice.
function fakeHid() {
  const listeners: Record<string, ((e: HIDConnectionEvent) => void)[]> = { connect: [], disconnect: [] };
  const vibe = (): HIDDevice =>
    ({ vendorId: 0x05ac, productId: 0x024f, productName: 'Mechlands Vibe75', collections: [], opened: false }) as unknown as HIDDevice;
  const first = vibe();
  const hid = {
    getDevices: async () => [first],
    requestDevice: async () => [vibe()],
    addEventListener: (t: 'connect' | 'disconnect', l: (e: HIDConnectionEvent) => void) => listeners[t]!.push(l),
    removeEventListener: () => {},
  } as unknown as HID;
  return { hid, first, fire: (t: 'disconnect', device: HIDDevice) => listeners[t]!.forEach((l) => l({ device } as HIDConnectionEvent)) };
}

it('merges a re-granted device into its entry and counts the reconnect', async () => {
  const { hid, first, fire } = fakeHid();
  const d = new Devices(hid);
  await d.start();
  expect(d.list).toHaveLength(1);
  fire('disconnect', first);
  expect(d.list[0]!.presence).toBe('disconnected');
  await d.request('supported');
  expect(d.list).toHaveLength(1);
  expect(d.list[0]!.presence).toBe('connected');
  expect(d.list[0]!.reconnects).toBe(1);
  expect(d.list[0]!.match?.entry.id).toBe('mechlands/vibe75');
});
