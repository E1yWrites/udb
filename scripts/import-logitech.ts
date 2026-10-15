// Generates registry/devices/logitech/*.json: one entry per HID++ 2.0 mouse or
// keyboard in libratbag's device data (third_party/libratbag, MIT), wired
// mice libratbag lacks from OpenMouse's list (third_party/openmouse), and one
// generic entry for receivers and models in neither list. Run with
// `npm run import:logitech`, then `npm run support`. Everything generated is
// experimental: nothing here has been verified on hardware by UDB.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Category, Collection, DeviceEntry, Feature, Identity } from '../src/lib/registry.ts';

const root = new URL('..', import.meta.url).pathname;
const read = (path: string) => JSON.parse(readFileSync(join(root, path), 'utf8'));
const ratbag = read('third_party/libratbag/logitech-devices.json') as {
  devices: { file: string; name: string; match: string[]; driver: string; type: string }[];
};
const openmouse = read('third_party/openmouse/logitech-products.json') as { products: { pid: string; name: string }[] };

const DATE = '2026-10-15';
const RATBAG = 'libratbag data/devices @8235b5bb (third_party/libratbag)';
const OPENMOUSE = 'OpenMouse mouse-protocol @e53af6d5 (src/logitech/index.ts, src/drivers/logitech/hidpp.ts)';
const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}` as const;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\+/g, ' plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const evidence = (source: string) => [{ source, hardware: null, date: DATE, confidence: 'low' as const }];

const COLLECTIONS: Collection[] = [
  { usagePage: '0xFF00', usage: '0x0001', reportIds: [0x10], purpose: 'HID++ short reports (7 bytes); receivers and wired devices' },
  { usagePage: '0xFF00', usage: '0x0002', reportIds: [0x11], purpose: 'HID++ long reports (20 bytes); the only ones Bolt devices answer on' },
  { usagePage: '0xFF43', usage: '0x0202', reportIds: [0x11], purpose: 'HID++ long reports over Bluetooth and on some newer USB mice' },
];

const PROTOCOL: DeviceEntry['protocol'] = {
  family: 'logitech-hidpp',
  doc: 'docs/protocols/logitech-hidpp.md',
  references: [
    { title: 'OpenMouse mouse-protocol (Logitech HID++ driver)', url: 'https://github.com/OpenMouse-Project/mouse-protocol', license: 'AGPL-3.0-or-later', use: 'code' },
    { title: 'libratbag device data', url: 'https://github.com/libratbag/libratbag/tree/master/data/devices', license: 'MIT', use: 'code' },
    { title: 'Solaar settings templates', url: 'https://github.com/pwr-Solaar/Solaar', license: 'GPL-2.0-or-later', use: 'facts-only' },
  ],
};

const LIMITATIONS = [
  'Nothing here has been verified on hardware by UDB.',
  'Which settings appear depends on the HID++ features the device reports when UDB reads it.',
  'UDB never switches the onboard-profile mode. In host mode, live DPI and report-rate changes are lost at power-off; in onboard mode some mice refuse them.',
  'Onboard profiles, button mapping and lighting are not implemented. DFU, reset and host-change features are refused.',
];

function features(category: Category, wireless: boolean): Feature[] {
  const f = (id: string, kind: Feature['kind'], status: Feature['status'], source: string, extra: Partial<Feature> = {}): Feature => ({
    id,
    kind,
    location: 'device',
    status,
    evidence: evidence(source),
    ...extra,
  });
  const out: Feature[] = [];
  if (category === 'mouse') {
    out.push(
      f('dpi', 'range', 'experimental', `${OPENMOUSE}: 0x2202 functions 5/6, 0x2201 functions 2/3`, {
        readBack: true,
        notes: 'Sensor 0, X = Y, values the sensor advertises (0x2202 preferred over 0x2201)',
      }),
    );
  }
  out.push(
    f('polling-rate', 'enum', 'experimental', `${OPENMOUSE}: 0x8061 functions 1-3, 0x8060 functions 0-2`, {
      readBack: true,
      constraints: { values: [125, 250, 500, 1000, 2000, 4000, 8000] },
      notes: 'Rates the link advertises',
    }),
  );
  if (wireless) out.push(f('battery', 'readonly', 'experimental', `${OPENMOUSE}: 0x1004, 0x1000, 0x1001`, { readBack: true }));
  out.push(f('onboard-profiles', 'profile', 'unsupported', `${OPENMOUSE}: 0x8100`, { notes: 'Mode is shown read-only; profile writes are Phase 5' }));
  out.push(f(category === 'mouse' ? 'buttons' : 'keymap', 'keymap', 'unsupported', `${OPENMOUSE}: 0x1B04`));
  out.push(f('lighting', 'color', 'unsupported', `${OPENMOUSE}: 0x8070, 0x8071, 0x8081`));
  return out;
}

function entry(id: string, model: string, category: Category, identities: Identity[], source: string): DeviceEntry {
  const wireless = identities.some((i) => i.connection !== 'wired');
  return {
    id,
    vendor: 'Logitech',
    model,
    category,
    identities,
    protocol: PROTOCOL,
    collections: { use: COLLECTIONS, deny: [] },
    platform: {
      windows: { status: 'documented', notes: 'Target platform; not yet tested' },
      linux: { status: 'documented', notes: 'Needs a udev rule for hidraw. hid-logitech-dj exposes a receiver’s mouse under its wireless PID.' },
      macos: { status: 'unknown' },
    },
    conflictingSoftware: ['Logitech G HUB', 'Logi Options+', 'Solaar'],
    limitations: [`Generated from ${source}.`, ...LIMITATIONS],
    features: features(category, wireless),
  };
}

/** libratbag's `usb:046d:c08b` style matches: C-range PIDs are cables, 4xxx are wireless PIDs behind a receiver. */
function identity(match: string): Identity | null {
  const [bus, vid, pid] = match.split(':');
  if (vid !== '046d' || !pid) return null;
  const n = parseInt(pid, 16);
  if (bus === 'bluetooth') return { vid: '0x046D', pid: hex(n), connection: 'bluetooth' };
  if (bus !== 'usb') return null;
  if (n >= 0x4000 && n < 0x5000) {
    return { vid: '0x046D', pid: hex(n), connection: 'dongle', notes: 'Wireless PID. Behind a receiver UDB reads it from HID++ 0x0003; on Linux hid-logitech-dj exposes it directly.' };
  }
  return n >= 0xc000 ? { vid: '0x046D', pid: hex(n), connection: 'wired' } : null;
}

const entries: DeviceEntry[] = [];
const ids = new Set<string>();
const known = new Set<number>();
for (const d of ratbag.devices) {
  if (d.driver !== 'hidpp20' || (d.type !== 'mouse' && d.type !== 'keyboard')) continue;
  const identities = d.match.map(identity).filter((i): i is Identity => i !== null);
  if (!identities.length) continue;
  identities.forEach((i) => known.add(parseInt(i.pid!, 16)));
  const model = d.name.replace(/^Logitech\s+/, '');
  let id = `logitech/${slug(model)}`;
  if (ids.has(id)) id = `${id}-${slug(d.file.replace(/^logitech-|\.device$/g, ''))}`;
  ids.add(id);
  entries.push(entry(id, model, d.type, identities, `${RATBAG}, ${d.file}`));
}
for (const p of openmouse.products) {
  const pid = parseInt(p.pid, 16);
  if (known.has(pid)) continue;
  const id = `logitech/${slug(p.name)}`;
  if (ids.has(id)) throw new Error(`Duplicate id ${id}`);
  ids.add(id);
  entries.push(entry(id, p.name, 'mouse', [{ vid: '0x046D', pid: hex(pid), connection: 'wired' }], `${OPENMOUSE} LOGITECH_PRODUCTS`));
}

const generic = entry(
  'logitech/hidpp-device',
  'HID++ 2.0 device or receiver',
  'mouse',
  [
    {
      byCollection: true,
      vid: '0x046D',
      connection: 'unknown',
      notes: 'Any Logitech HID++ interface: Lightspeed, Unifying and Bolt receivers, and models in neither source list. The model is resolved from the wireless PID the device reports (HID++ 0x0003) or shown by its own name (0x0005).',
    },
  ],
  `${OPENMOUSE}: receivers are found by vendor and HID++ collection, not by a PID list`,
);
generic.features = features('mouse', true);
entries.push(generic);

const dir = join(root, 'registry/devices/logitech');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
for (const e of entries) writeFileSync(join(root, 'registry/devices', `${e.id}.json`), JSON.stringify({ $schema: '../../schema/device.schema.json', ...e }, null, 2) + '\n');
console.log(`Generated ${entries.length} Logitech entries (${entries.filter((e) => e.category === 'mouse').length} mice, ${entries.filter((e) => e.category === 'keyboard').length} keyboards)`);
