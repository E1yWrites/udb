import { hex, type DeviceEntry, type Identity } from './registry.ts';

/** The parts of a WebHID HIDDevice that matching needs. */
export interface HidInfo {
  vendorId: number;
  productId: number;
  productName: string;
  /** Needed only to match `byCollection` identities. */
  collections?: Pick<HIDCollectionInfo, 'usagePage' | 'usage'>[];
}

export interface Match {
  entry: DeviceEntry;
  identity: Identity;
  /**
   * False when the VID/PID is shared (several entries match) or when the model
   * is only known after a protocol query (protocolIdentity, e.g. compx CID/MID).
   * Phase 2 sends nothing, so such models stay unconfirmed. Always false for
   * a `byCollection` identity: it names a protocol, not a model.
   */
  modelConfirmed: boolean;
}

function identityMatches(id: Identity, dev: HidInfo): boolean {
  if (!id.vid || !id.pid || hex(id.vid) !== dev.vendorId || hex(id.pid) !== dev.productId) return false;
  return !id.requireProductName || id.productName === dev.productName;
}

const exposes = (entry: DeviceEntry, dev: HidInfo) =>
  (dev.collections ?? []).some((c) => entry.collections.use.some((u) => hex(u.usagePage) === c.usagePage && hex(u.usage) === c.usage));

/**
 * Every registry identity this HID device could be (several when a receiver ID
 * is shared). `byCollection` identities count only when no VID/PID matches.
 */
export function candidates(dev: HidInfo, entries: DeviceEntry[]): { entry: DeviceEntry; identity: Identity }[] {
  const hits = (keep: (id: Identity, entry: DeviceEntry) => boolean) =>
    entries.flatMap((entry) => entry.identities.filter((id) => keep(id, entry)).map((identity) => ({ entry, identity })));
  const specific = hits((id) => identityMatches(id, dev));
  if (specific.length) return specific;
  return hits((id, entry) => !!id.byCollection && (!id.vid || hex(id.vid) === dev.vendorId) && exposes(entry, dev));
}

/** Narrows candidates by the CID/MID the device reported. Null when nothing matches. */
export function resolveByProtocolIdentity(
  dev: HidInfo,
  entries: DeviceEntry[],
  reported: { cid: number; mid: number },
): { entry: DeviceEntry; identity: Identity } | null {
  return (
    candidates(dev, entries).find(
      ({ identity }) => identity.protocolIdentity?.cid === reported.cid && identity.protocolIdentity?.mid === reported.mid,
    ) ?? null
  );
}

export function matchDevice(dev: HidInfo, entries: DeviceEntry[]): Match | null {
  const hits = candidates(dev, entries);
  const first = hits[0];
  if (!first) return null;
  const entryCount = new Set(hits.map((h) => h.entry.id)).size;
  return { ...first, modelConfirmed: entryCount === 1 && !first.identity.protocolIdentity && !first.identity.byCollection };
}

/** requestDevice filters: only collections an adapter will use, never denied ones. */
export function chooserFilters(entries: DeviceEntry[]): HIDDeviceFilter[] {
  const seen = new Set<string>();
  const filters: HIDDeviceFilter[] = [];
  for (const entry of entries) {
    for (const id of entry.identities) {
      for (const c of entry.collections.use) {
        const usage = { usagePage: hex(c.usagePage), usage: hex(c.usage) };
        const f = { ...(id.vid ? { vendorId: hex(id.vid) } : {}), ...(id.pid ? { productId: hex(id.pid) } : {}), ...usage };
        const key = JSON.stringify(f);
        if (seen.has(key)) continue;
        seen.add(key);
        filters.push(f);
      }
    }
  }
  return filters;
}
