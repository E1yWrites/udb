import { hex, type DeviceEntry, type Identity } from './registry.ts';

/** The parts of a WebHID HIDDevice that matching needs. */
export interface HidInfo {
  vendorId: number;
  productId: number;
  productName: string;
}

export interface Match {
  entry: DeviceEntry;
  identity: Identity;
  /**
   * False when the VID/PID is shared (several entries match) or when the model
   * is only known after a protocol query (protocolIdentity, e.g. compx CID/MID).
   * Phase 2 sends nothing, so such models stay unconfirmed.
   */
  modelConfirmed: boolean;
}

function identityMatches(id: Identity, dev: HidInfo): boolean {
  if (hex(id.vid) !== dev.vendorId || hex(id.pid) !== dev.productId) return false;
  return !id.requireProductName || id.productName === dev.productName;
}

export function matchDevice(dev: HidInfo, entries: DeviceEntry[]): Match | null {
  const hits = entries.flatMap((entry) =>
    entry.identities.filter((id) => identityMatches(id, dev)).map((identity) => ({ entry, identity })),
  );
  const first = hits[0];
  if (!first) return null;
  const entryCount = new Set(hits.map((h) => h.entry.id)).size;
  return { ...first, modelConfirmed: entryCount === 1 && !first.identity.protocolIdentity };
}

/** requestDevice filters: only collections an adapter will use, never denied ones. */
export function chooserFilters(entries: DeviceEntry[]): HIDDeviceFilter[] {
  const seen = new Set<string>();
  const filters: HIDDeviceFilter[] = [];
  for (const entry of entries) {
    for (const id of entry.identities) {
      for (const c of entry.collections.use) {
        const f = { vendorId: hex(id.vid), productId: hex(id.pid), usagePage: hex(c.usagePage), usage: hex(c.usage) };
        const key = JSON.stringify(f);
        if (seen.has(key)) continue;
        seen.add(key);
        filters.push(f);
      }
    }
  }
  return filters;
}
