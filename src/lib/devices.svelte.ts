// Discovery: which devices the user granted, which are connected, and what the
// registry knows about them. Phase 2 sends no reports; opening a device only
// checks that no other app holds it, and it is closed again right away.

import { chooserFilters, matchDevice, type Match } from './match.ts';
import { registry } from './registry.ts';
import { open } from './transport.ts';

export type Presence = 'connected' | 'busy' | 'disconnected';

export interface UdbDevice {
  key: string;
  vendorId: number;
  productId: number;
  productName: string;
  /** One WebHID object per interface; Chromium splits composite devices. */
  interfaces: HIDDevice[];
  match: Match | null;
  presence: Presence;
  openError?: string;
  /** Times the device came back after a disconnect, for persistence checks. */
  reconnects: number;
}

export type RequestOutcome = { kind: 'idle' } | { kind: 'cancelled' } | { kind: 'error'; message: string };

export const keyOf = (d: Pick<HIDDevice, 'vendorId' | 'productId' | 'productName'>) =>
  `${d.vendorId.toString(16).padStart(4, '0')}:${d.productId.toString(16).padStart(4, '0')}:${d.productName}`;

function usesCollection(match: Match | null, hid: HIDDevice): boolean {
  const use = match?.entry.collections.use ?? [];
  return hid.collections.some((c) => use.some((u) => parseInt(u.usagePage, 16) === c.usagePage && parseInt(u.usage, 16) === c.usage));
}

export class Devices {
  readonly hid: HID | undefined;
  readonly secure = typeof isSecureContext === 'undefined' ? false : isSecureContext;

  constructor(hid: HID | undefined = typeof navigator === 'undefined' ? undefined : navigator.hid) {
    this.hid = hid;
  }

  list = $state<UdbDevice[]>([]);
  outcome = $state<RequestOutcome>({ kind: 'idle' });
  /** Last connection change, for the polite live region. */
  announcement = $state('');

  async start(): Promise<void> {
    if (!this.hid) return;
    this.hid.addEventListener('connect', (e) => void this.add([e.device], true));
    this.hid.addEventListener('disconnect', (e) => this.remove(e.device));
    await this.add(await this.hid.getDevices(), false);
  }

  /** Opens the browser chooser. `any` lists every HID device, to identify unsupported ones. */
  async request(mode: 'supported' | 'any'): Promise<void> {
    if (!this.hid) return;
    try {
      const picked = await this.hid.requestDevice({ filters: mode === 'any' ? [] : chooserFilters(registry) });
      this.outcome = picked.length ? { kind: 'idle' } : { kind: 'cancelled' };
      await this.add(picked, true);
    } catch (e) {
      this.outcome = { kind: 'error', message: e instanceof Error ? e.message : String(e) };
    }
  }

  async retry(device: UdbDevice): Promise<void> {
    device.presence = 'connected';
    device.openError = undefined;
    for (const hid of device.interfaces) await this.checkAccess(device, hid);
  }

  private async add(hids: HIDDevice[], announce: boolean): Promise<void> {
    for (const hid of hids) {
      const key = keyOf(hid);
      let device = this.list.find((d) => d.key === key);
      if (!device) {
        this.list.push({
          key,
          vendorId: hid.vendorId,
          productId: hid.productId,
          productName: hid.productName,
          interfaces: [],
          match: matchDevice(hid, registry),
          presence: 'connected',
          reconnects: 0,
        });
        device = this.list[this.list.length - 1]!;
      }
      if (!device.interfaces.includes(hid)) device.interfaces.push(hid);
      // Composite devices arrive one interface at a time; a byCollection match may only show on a later one.
      device.match ??= matchDevice(hid, registry);
      if (device.presence === 'disconnected') {
        device.presence = 'connected';
        device.reconnects++;
      }
      await this.checkAccess(device, hid);
      if (announce) this.announcement = `${this.label(device)} connected`;
    }
  }

  /** Busy if an interface UDB would use can't be opened. Closed again at once. */
  private async checkAccess(device: UdbDevice, hid: HIDDevice): Promise<void> {
    if (!usesCollection(device.match, hid) || hid.opened) return;
    const result = await open(hid);
    if (result.ok) {
      await hid.close();
      return;
    }
    device.presence = 'busy';
    device.openError = result.error;
  }

  private remove(hid: HIDDevice): void {
    const device = this.list.find((d) => d.interfaces.includes(hid));
    if (!device) return;
    device.interfaces = device.interfaces.filter((i) => i !== hid);
    if (device.interfaces.length === 0) {
      device.presence = 'disconnected';
      this.announcement = `${this.label(device)} disconnected`;
    }
  }

  label(d: UdbDevice): string {
    if (d.match?.modelConfirmed) return `${d.match.entry.vendor} ${d.match.entry.model}`;
    return d.productName || 'Unnamed HID device';
  }
}

export const devices = new Devices();
