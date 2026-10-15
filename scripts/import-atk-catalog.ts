// Generates registry/devices/{atk,vxe}/*.json from the vendored OpenMouse copy
// of the ATK HUB device catalog. Run with `npm run import:atk`, then
// `npm run support`. Generated entries are experimental: nothing in them has
// been verified on hardware by UDB.
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ATK_MOUSE_DEVICES, type AtkDeviceDescriptor } from '../third_party/openmouse/atk-device-catalog.ts';
import { DPI_SENSORS } from '../src/adapters/compx-dpi.ts';
import type { DeviceEntry, Feature } from '../src/lib/registry.ts';

const root = new URL('..', import.meta.url).pathname;
const DATE = '2026-10-15';
const SOURCE = 'OpenMouse mouse-protocol @c3b1bc20: ATK HUB 3.2.27 catalog (third_party/openmouse/atk-device-catalog.ts) and its ATK driver';
const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}` as const;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\+/g, ' plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const evidence = (source: string) => [{ source, hardware: null, date: DATE, confidence: 'low' as const }];

function features(d: AtkDeviceDescriptor): Feature[] {
  const nearlink = !!d.features.isNearlink;
  const vxeR1 = d.brand === 'VXE' && /\bR1\b/i.test(d.model);
  const sensor = d.sensor && DPI_SENSORS[d.sensor] ? d.sensor : null;
  const out: Feature[] = [];
  const add = (f: Omit<Feature, 'evidence'>, source = SOURCE) => out.push({ ...f, evidence: evidence(source) });
  const transportNote = nearlink ? 'NearLink models use another collection (0xFF05); the UDB transport is unconfirmed' : undefined;

  add({
    id: 'polling-rate',
    kind: 'enum',
    location: 'device',
    readBack: true,
    status: nearlink || vxeR1 ? 'unsupported' : 'experimental',
    constraints: { values: [125, 250, 500, 1000, 2000, 4000, 8000] },
    ...(vxeR1 ? { notes: 'VXE R1 receivers keep polling in a live-settings row (0x0070), not at 0x00' } : transportNote ? { notes: transportNote } : {}),
  });
  if (sensor) {
    const s = DPI_SENSORS[sensor]!;
    add({
      id: 'dpi.stages',
      kind: 'range',
      location: 'device',
      readBack: true,
      status: nearlink ? 'unsupported' : 'experimental',
      constraints: { sensor, family: s.family, minDpi: s.minDpi, maxDpi: s.maxDpi },
      ...(transportNote ? { notes: transportNote } : {}),
    });
  } else {
    add({
      id: 'dpi.stages',
      kind: 'range',
      location: 'device',
      status: 'unsupported',
      notes: d.sensor ? `${d.sensor} uses six-byte DPI rows that UDB does not implement yet` : 'Sensor unknown',
    });
  }
  add({ id: 'dpi.current-stage', kind: 'range', location: 'device', readBack: true, status: nearlink ? 'unsupported' : 'experimental' });
  add({
    id: 'debounce-ms',
    kind: 'range',
    location: 'device',
    readBack: true,
    status: nearlink ? 'unsupported' : 'experimental',
    constraints: { min: 0, max: 20 },
  });
  return out;
}

const groups = new Map<string, AtkDeviceDescriptor[]>();
for (const d of ATK_MOUSE_DEVICES) {
  const key = `${d.brand}|${d.model}|${d.sensor ?? ''}`;
  groups.set(key, [...(groups.get(key) ?? []), d]);
}

const ids = new Set<string>();
const entries: DeviceEntry[] = [];
for (const list of groups.values()) {
  const first = list[0]!;
  const vendor = first.brand.toLowerCase();
  let id = `${vendor}/${slug(first.model.replace(new RegExp(`^${first.brand}\\s+`, 'i'), ''))}`;
  if (ids.has(id)) id = `${id}-${slug(first.sensor ?? 'unknown')}`;
  ids.add(id);
  entries.push({
    id,
    vendor: first.brand,
    model: first.model.replace(new RegExp(`^${first.brand}\\s+`, 'i'), ''),
    category: 'mouse',
    identities: list.map((d) => {
      const [cid, mid] = d.cidMid ? d.cidMid.split(',').map(Number) : [null, null];
      return {
        vid: hex(d.vendorId),
        pid: hex(d.productId),
        connection: 'unknown' as const,
        ...(d.cidMid ? { protocolIdentity: { cid: cid!, mid: mid! } } : {}),
      };
    }),
    protocol: {
      family: 'compx',
      doc: 'docs/protocols/compx.md',
      references: [
        { title: 'OpenMouse mouse-protocol (ATK driver and catalog)', url: 'https://github.com/OpenMouse-Project/mouse-protocol', license: 'AGPL-3.0-or-later', use: 'code' },
        { title: 'ATK HUB 3.2.27 (web)', url: 'https://hub.atk.pro/', license: 'proprietary', use: 'facts-only' },
      ],
      params: { identify: 'cidmid' },
    },
    collections: {
      use: [{ usagePage: '0xFF02', usage: '0x0002', reportIds: [8], purpose: 'Command channel per OpenMouse (16-byte report 0x08); the vendor hub lists 0xFF04 on the same device' }],
      deny: [],
    },
    platform: { windows: { status: 'unknown' }, linux: { status: 'unknown' }, macos: { status: 'unknown' } },
    conflictingSoftware: [`${first.brand} HUB (open in another tab)`],
    limitations: [
      'Generated from OpenMouse’s copy of the ATK HUB catalog. Nothing here has been verified on hardware by UDB.',
      'Same platform and framing as the Pulsar X2 CrazyLight, which UDB has verified; register layout per OpenMouse’s ATK captures.',
    ],
    features: features(first),
  });
}

for (const vendor of new Set(entries.map((e) => e.id.split('/')[0]!))) {
  const dir = join(root, 'registry/devices', vendor);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}
for (const e of entries) {
  writeFileSync(join(root, 'registry/devices', `${e.id}.json`), JSON.stringify({ $schema: '../../schema/device.schema.json', ...e }, null, 2) + '\n');
}
const count = (v: string) => readdirSync(join(root, 'registry/devices', v)).length;
console.log(`Generated ${entries.length} entries from ${ATK_MOUSE_DEVICES.length} catalog rows (atk ${count('atk')}, vxe ${count('vxe')})`);
