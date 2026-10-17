// Generates the detection-only ASUS Aura keyboard and mouse entries in
// registry/devices/asus/ from the product IDs OpenRGB's Aura detector lists.
// Run with `npm run import:aura`, then `npm run support`. The G14 entry is
// hand-written and stays; only files whose family is `asus-aura` are replaced.
// Nothing here is verified on hardware, and no adapter exists: UDB sends these
// devices nothing (docs/protocols/asus-aura.md).
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Category, Connection, DeviceEntry } from '../src/lib/registry.ts';

const root = new URL('..', import.meta.url).pathname;
const dir = join(root, 'registry/devices/asus');
const DATE = '2026-10-17';
const SOURCE =
  'OpenRGB @8e16de27, Controllers/AsusAuraUSBController: AsusAuraUSBControllerDetect.cpp, AsusAuraMouseController/AsusAuraMouseDevices.h (GPL-2.0-or-later): product IDs and names';
const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}` as const;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Pid = [pid: number, connection: Connection, notes?: string];
const W = 'wired' as const;
const D = 'dongle' as const;
const B = 'bluetooth' as const;
const CABLE = 'USB (cable) mode of a wireless model';

// [category, model, identities]. A PID appears once: OpenRGB lists 0x189E for
// both the Gladius II Wireless and the Strix Impact II Gundam, and 0x1979 for
// both the Spatha X 2.4 GHz dongle and its dock.
const MODELS: [Category, string, Pid[]][] = [
  ['keyboard', 'ROG Azoth', [[0x1a83, W], [0x1a85, D]]],
  ['keyboard', 'ROG Claymore', [[0x184d, W]]],
  ['keyboard', 'ROG Falchion', [[0x193c, W], [0x193e, D]]],
  ['keyboard', 'ROG Strix Flare', [[0x1875, W]]],
  ['keyboard', 'ROG Strix Flare PNK LTD', [[0x18cf, W]]],
  ['keyboard', 'ROG Strix Flare CoD Black Ops 4 Edition', [[0x18af, W]]],
  ['keyboard', 'ROG Strix Flare II', [[0x19fe, W]]],
  ['keyboard', 'ROG Strix Flare II Animate', [[0x19fc, W]]],
  ['keyboard', 'ROG Strix Scope', [[0x18f8, W]]],
  ['keyboard', 'ROG Strix Scope TKL', [[0x190c, W]]],
  ['keyboard', 'ROG Strix Scope TKL PNK LTD', [[0x1954, W]]],
  ['keyboard', 'ROG Strix Scope RX', [[0x1951, W]]],
  ['keyboard', 'ROG Strix Scope RX EVA-02 Edition', [[0x1b12, W]]],
  ['keyboard', 'ROG Strix Scope RX TKL Wireless Deluxe', [[0x1a05, W, CABLE]]],
  ['keyboard', 'ROG Strix Scope NX Wireless Deluxe', [[0x19f6, W, CABLE], [0x19f8, D]]],
  ['keyboard', 'ROG Strix Scope II', [[0x1ab3, W]]],
  ['keyboard', 'ROG Strix Scope II RX', [[0x1ab5, W]]],
  ['keyboard', 'ROG Strix Scope II 96 Wireless', [[0x1aae, W, CABLE]]],
  ['keyboard', 'ROG Strix Scope II 96 RX Wireless', [[0x1b78, W, CABLE]]],
  ['keyboard', 'TUF Gaming K1', [[0x1945, W]]],
  ['keyboard', 'TUF Gaming K3', [[0x194b, W]]],
  ['keyboard', 'TUF Gaming K3 Gen II', [[0x1b30, W]]],
  ['keyboard', 'TUF Gaming K3 Gen II Miku Edition', [[0x1c5e, W]]],
  ['keyboard', 'TUF Gaming K5', [[0x1899, W]]],
  ['keyboard', 'TUF Gaming K7', [[0x18aa, W]]],
  ['mouse', 'ROG Gladius II Core', [[0x18dd, W]]],
  ['mouse', 'ROG Gladius II', [[0x1845, W]]],
  ['mouse', 'ROG Gladius II Origin', [[0x1877, W]]],
  ['mouse', 'ROG Gladius II Origin PNK LTD', [[0x18cd, W]]],
  ['mouse', 'ROG Gladius II Origin CoD', [[0x18b1, W]]],
  ['mouse', 'ROG Gladius II Wireless', [[0x189e, D, 'OpenRGB also lists this PID for the Strix Impact II Gundam Edition'], [0x18a0, W]]],
  ['mouse', 'ROG Gladius III', [[0x197b, W]]],
  ['mouse', 'ROG Gladius III Core', [[0x1c8d, W]]],
  ['mouse', 'ROG Gladius III Wireless', [[0x197d, W, CABLE], [0x197f, D], [0x1981, B]]],
  ['mouse', 'ROG Gladius III Wireless AimPoint', [[0x1a70, W, CABLE], [0x1a72, D], [0x1a74, B]]],
  ['mouse', 'ROG Chakram', [[0x18e3, W], [0x18e5, D]]],
  ['mouse', 'ROG Chakram Core', [[0x1958, W]]],
  ['mouse', 'ROG Chakram X', [[0x1a18, W, CABLE], [0x1a1a, D]]],
  ['mouse', 'ROG Spatha X', [[0x1977, W, CABLE], [0x1979, D, 'Also the Spatha X dock in OpenRGB']]],
  ['mouse', 'ROG Pugio', [[0x1846, W]]],
  ['mouse', 'ROG Pugio II', [[0x1906, W], [0x1908, D]]],
  ['mouse', 'ROG Strix Impact', [[0x1847, W]]],
  ['mouse', 'ROG Strix Impact II', [[0x18e1, W]]],
  ['mouse', 'ROG Strix Impact II Electro Punk', [[0x1956, W]]],
  ['mouse', 'ROG Strix Impact II Moonlight White', [[0x19d2, W]]],
  ['mouse', 'ROG Strix Impact II Wireless', [[0x1947, W, CABLE], [0x1949, D]]],
  ['mouse', 'ROG Strix Impact III', [[0x1a88, W]]],
  ['mouse', 'ROG Keris', [[0x195c, W]]],
  ['mouse', 'ROG Keris Wireless', [[0x195e, W, CABLE], [0x1960, D], [0x1962, B]]],
  ['mouse', 'ROG Keris Wireless AimPoint', [[0x1a66, W, CABLE], [0x1a68, D], [0x1a6a, B]]],
  ['mouse', 'TUF Gaming M3', [[0x1910, W]]],
  ['mouse', 'TUF Gaming M3 Gen II', [[0x1a9b, W]]],
  ['mouse', 'TUF Gaming M5', [[0x1898, W]]],
  ['mouse', 'ROG Strix Evolve', [[0x185b, W]]],
  ['mouse', 'ROG Spatha', [[0x181c, W], [0x1824, D]]],
];

const seen = new Set<number>();
for (const [, model, ids] of MODELS) for (const [pid] of ids) if (seen.has(pid)) throw new Error(`duplicate PID ${hex(pid)} (${model})`);
else seen.add(pid);

for (const f of readdirSync(dir)) {
  const p = join(dir, f);
  if (JSON.parse(readFileSync(p, 'utf8')).protocol?.family === 'asus-aura') unlinkSync(p);
}

for (const [category, model, ids] of MODELS) {
  const entry: DeviceEntry = {
    id: `asus/${slug(model)}`,
    vendor: 'ASUS',
    model,
    category,
    identities: ids.map(([pid, connection, notes]) => ({ vid: '0x0B05', pid: hex(pid), connection, ...(notes ? { notes } : {}) })),
    protocol: {
      family: 'asus-aura',
      doc: 'docs/protocols/asus-aura.md',
      references: [{ title: 'OpenRGB AsusAuraUSBController', url: 'https://gitlab.com/CalcProgrammer1/OpenRGB', license: 'GPL-2.0-or-later', use: 'facts-only' }],
    },
    collections: { use: [], deny: [] },
    platform: { windows: { status: 'documented', notes: 'Detection only' }, linux: { status: 'unknown' }, macos: { status: 'unknown' } },
    conflictingSoftware: ['Armoury Crate'],
    limitations: [
      'Detection only: UDB sends nothing to ASUS Aura devices.',
      'Aura lighting is streamed to the device and cannot be read back, so it could never be write-verified.',
      'Identified by VID/PID through “Identify another device”; UDB requests no Aura interface.',
      `Generated from ${SOURCE}.`,
    ],
    features: [
      {
        id: 'lighting',
        kind: 'color',
        location: 'device',
        status: 'unsupported',
        evidence: [{ source: SOURCE, hardware: null, date: DATE, confidence: 'low', notes: 'No read-back exists in OpenRGB’s driver; see docs/protocols/asus-aura.md' }],
      },
    ],
  };
  writeFileSync(join(dir, `${slug(model)}.json`), JSON.stringify({ $schema: '../../schema/device.schema.json', ...entry }, null, 2) + '\n');
}
console.log(`Generated ${MODELS.length} ASUS Aura entries from ${seen.size} product IDs`);
