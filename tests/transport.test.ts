import { describe, expect, it, vi } from 'vitest';
import { open, receiveFeature, send, TransportRejected, type Guard, type OutgoingReport } from '../src/lib/transport.ts';

// Shaped like the G14 keyboard: a usable vendor collection next to a firmware
// collection that must never be reached, all on one HID device.
function fakeDevice(opened = true) {
  return {
    opened,
    collections: [
      { usagePage: 0xff02, usage: 0x0002, outputReports: [{ reportId: 8 }], featureReports: [] },
      { usagePage: 0xff82, usage: 0x00cf, outputReports: [{ reportId: 0x5a }], featureReports: [{ reportId: 0x5a }] },
      { usagePage: 0xff31, usage: 0x0079, children: [{ featureReports: [{ reportId: 0x5d }] }] },
    ],
    sendReport: vi.fn(async () => {}),
    sendFeatureReport: vi.fn(async () => {}),
    receiveFeatureReport: vi.fn(async () => new DataView(new ArrayBuffer(1))),
  };
}

const guard: Guard = {
  allow: (r) => r.data[0] === 0x08, // e.g. compx ReadFlashData only
  deny: [{ usagePage: 0xff82, usage: 0x00cf }],
};

const out = (reportId: number, ...bytes: number[]): OutgoingReport => ({ type: 'output', reportId, data: Uint8Array.from(bytes) });

async function rejection(p: Promise<unknown>) {
  const e = await p.then(() => null, (err: unknown) => err);
  expect(e).toBeInstanceOf(TransportRejected);
  return (e as TransportRejected).reason;
}

describe('transport.send', () => {
  it('sends an allowlisted report on a usable collection', async () => {
    const d = fakeDevice();
    await send(d, out(8, 0x08, 0, 0), guard);
    expect(d.sendReport).toHaveBeenCalledWith(8, Uint8Array.of(0x08, 0, 0));
  });

  it('refuses a command the adapter does not allow, before WebHID sees it', async () => {
    const d = fakeDevice();
    expect(await rejection(send(d, out(8, 0x0d), guard))).toBe('not-allowlisted'); // compx EnterUsbUpdateMode
    expect(d.sendReport).not.toHaveBeenCalled();
  });

  it('refuses any report on a denied collection, even one the allowlist would accept', async () => {
    const d = fakeDevice();
    expect(await rejection(send(d, out(0x5a, 0x08), guard))).toBe('denied-collection');
    expect(await rejection(send(d, { type: 'feature', reportId: 0x5a, data: Uint8Array.of(0x08) }, guard))).toBe('denied-collection');
    expect(await rejection(receiveFeature(d, 0x5a, { ...guard, allow: () => true }))).toBe('denied-collection');
    expect(d.sendReport).not.toHaveBeenCalled();
    expect(d.sendFeatureReport).not.toHaveBeenCalled();
    expect(d.receiveFeatureReport).not.toHaveBeenCalled();
  });

  it('refuses report IDs the device does not declare', async () => {
    const d = fakeDevice();
    expect(await rejection(send(d, out(9, 0x08), guard))).toBe('undeclared-report');
    expect(d.sendReport).not.toHaveBeenCalled();
  });

  it('sends an undeclared feature report only where the registry names it (Razer)', async () => {
    const mouse = { ...fakeDevice(), collections: [{ usagePage: 0x0001, usage: 0x0002, inputReports: [{ reportId: 0 }] }] };
    const feature: OutgoingReport = { type: 'feature', reportId: 0, data: Uint8Array.of(0x08) };
    expect(await rejection(send(mouse, feature, guard))).toBe('undeclared-report');
    const razer: Guard = { ...guard, undeclared: [{ usagePage: 0x0001, usage: 0x0002, reportId: 0 }] };
    await send(mouse, feature, razer);
    expect(mouse.sendFeatureReport).toHaveBeenCalledOnce();
    await receiveFeature(mouse, 0, { ...razer, allow: () => true });
    expect(await rejection(send(mouse, { ...feature, reportId: 1 }, razer))).toBe('undeclared-report');
    expect(await rejection(send(mouse, { ...feature, type: 'output' }, razer))).toBe('undeclared-report');
    expect(await rejection(send(mouse, { ...feature, data: Uint8Array.of(0x0d) }, razer))).toBe('not-allowlisted');
    expect(await rejection(send(mouse, feature, { ...razer, deny: [{ usagePage: 0x0001, usage: 0x0002 }] }))).toBe('denied-collection');
  });

  it('finds feature reports declared in child collections', async () => {
    const d = fakeDevice();
    await send(d, { type: 'feature', reportId: 0x5d, data: Uint8Array.of(0x08) }, guard);
    expect(d.sendFeatureReport).toHaveBeenCalledOnce();
  });

  it('refuses to send on a closed device', async () => {
    const d = fakeDevice(false);
    expect(await rejection(send(d, out(8, 0x08), guard))).toBe('not-open');
  });
});

describe('transport.open', () => {
  it('reports why a device could not be opened (e.g. held by a vendor app)', async () => {
    const d = { opened: false, open: vi.fn(async () => { throw new DOMException('Failed to open the device.', 'InvalidStateError'); }) };
    expect(await open(d)).toEqual({ ok: false, error: 'InvalidStateError: Failed to open the device.' });
  });
});
