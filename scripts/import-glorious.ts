// Generates the detection-only Glorious mouse entries in
// registry/devices/glorious/ from the product tables in OpenMouse's
// src/drivers/vendors.ts and src/glorious-core2/index.ts (commit 54c68c69,
// AGPL-3.0-or-later, facts only). Run with `npm run import:glorious`, then
// `npm run support`. No adapter exists: UDB sends these mice nothing
// (docs/protocols/glorious.md).
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Connection, DeviceEntry, Identity } from '../src/lib/registry.ts';

const root = new URL('..', import.meta.url).pathname;
const dir = join(root, 'registry/devices/glorious');
const DATE = '2026-10-18';
const SOURCE = 'OpenMouse mouse-protocol @54c68c69: src/drivers/vendors.ts (GLORIOUS_PRODUCTS, GLORIOUS_CLASSIC_PRODUCTS) and src/glorious-core2/index.ts (GLORIOUS_CORE2_PRODUCTS)';
const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}` as const;
const slug = (s: string) => s.toLowerCase().replace(/([a-z])-(?= |$)/g, '$1 minus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Gen = 'pixart' | 'classic' | 'core2';
type Pid = [vid: number, pid: number, connection: Connection, notes?: string];
const W = 'wired' as const;
const D = 'dongle' as const;
const B = 'bluetooth' as const;
const PIXART = 0x093a;
const SINO = 0x258a;
// The 0x823a unit OpenMouse tested is on 0x320f and declares a 263-byte feature report; its classic payloads wrote without error and did nothing.
const V2 = 'Unconfirmed: OpenMouse found a unit of this kind on VID 0x320F with a 263-byte feature report, where its classic payloads had no effect';

const MODELS: [Gen, string, Pid[]][] = [
  ['pixart', 'Model I 2', [[PIXART, 0x821d, D], [PIXART, 0x821b, B]]],
  ['pixart', 'Model O 2 Wireless', [[PIXART, 0x822a, W], [PIXART, 0x822b, B], [PIXART, 0x822d, D]]],
  ['pixart', 'Model D 2 Wireless', [[PIXART, 0x824a, W], [PIXART, 0x824b, B], [PIXART, 0x824d, D]]],
  ['pixart', 'Model D 2 Wired', [[PIXART, 0x825a, W]]],
  ['pixart', 'Model O 2 Mini Wireless', [[PIXART, 0x826a, W], [PIXART, 0x826b, B], [PIXART, 0x826d, D]]],
  ['pixart', 'Model O 2 Mini Wired', [[PIXART, 0x827a, W]]],
  ['pixart', 'Model D- 2 Wired', [[PIXART, 0x832a, W]]],
  ['classic', 'Model O Wireless', [[SINO, 0x2011, W, 'OpenMouse’s sources disagree: one labels this PID Model D Wireless'], [SINO, 0x2022, D]]],
  ['classic', 'Model D Wireless', [[SINO, 0x2012, W], [SINO, 0x2023, D]]],
  ['classic', 'Model O- Wireless', [[SINO, 0x2013, W], [SINO, 0x2024, D]]],
  ['classic', 'Model D- Wireless', [[SINO, 0x2014, W], [SINO, 0x2025, D]]],
  ['classic', 'Model O 2 PRO', [[SINO, 0x2019, W], [SINO, 0x2033, D]]],
  ['classic', 'Series 2 PRO', [[SINO, 0x201d, W], [SINO, 0x2039, D]]],
  ['classic', 'Model O Pro', [[SINO, 0x2015, W], [SINO, 0x2027, D]]],
  ['classic', 'Series One Pro', [[SINO, 0x2018, W], [SINO, 0x2031, D]]],
  ['classic', 'Model D 2 PRO', [[SINO, 0x201a, W], [SINO, 0x2034, D]]],
  ['classic', 'Model I', [[0x22d4, 0x1503, W]]],
  ['classic', 'Model O V2', [[0x320f, 0x823a, W, V2]]],
  ['classic', 'Model I 2 Wireless', [[0x320f, 0x821a, W, V2]]],
  ['classic', 'Model I 2 Wired', [[0x320f, 0x831a, W, V2]]],
  ['classic', 'Model O3 Wireless', [[0x3794, 0xa312, 'unknown'], [0x3794, 0xa300, D]]],
  ['core2', 'Model O 2 PRO 4K/8K', [[SINO, 0x201b, W], [SINO, 0x2035, D]]],
  ['core2', 'Model D 2 PRO 4K/8K', [[SINO, 0x201c, W, 'Same frames as the O 2 PRO 4K/8K in CORE’s code; not captured'], [SINO, 0x2036, D, 'Same frames as the O 2 PRO 4K/8K in CORE’s code; not captured']]],
];

const GEN_NOTE: Record<Gen, string> = {
  pixart: 'Pixart-firmware generation: a 256-byte settings payload sent as four 64-byte feature reports; the firmware never echoes settings back.',
  classic: 'Classic generation: OpenMouse’s `glorious-classic` codec, write-only.',
  core2: '4K/8K generation: frames captured from Glorious CORE on a wired O 2 PRO 4K/8K; firmware and battery can be read, no setting can.',
};

const seen = new Set<string>();
for (const [, model, ids] of MODELS) for (const [vid, pid] of ids) {
  const k = `${vid}:${pid}`;
  if (seen.has(k)) throw new Error(`duplicate ${hex(vid)}:${hex(pid)} (${model})`);
  seen.add(k);
}

const slugs = MODELS.map(([, m]) => slug(m));
if (new Set(slugs).size !== slugs.length) throw new Error('two models share a file name');

mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) {
  const p = join(dir, f);
  if (JSON.parse(readFileSync(p, 'utf8')).protocol?.family === 'glorious') unlinkSync(p);
}

for (const [gen, model, ids] of MODELS) {
  const identities: Identity[] = ids.map(([vid, pid, connection, notes]) => ({ vid: hex(vid), pid: hex(pid), connection, ...(notes ? { notes } : {}) }));
  const entry: DeviceEntry = {
    id: `glorious/${slug(model)}`,
    vendor: 'Glorious',
    model,
    category: 'mouse',
    identities,
    protocol: {
      family: 'glorious',
      doc: 'docs/protocols/glorious.md',
      references: [{ title: 'OpenMouse mouse-protocol (Glorious drivers, product tables, O 2 PRO 4K/8K capture)', url: 'https://github.com/OpenMouse-Project/mouse-protocol', license: 'AGPL-3.0-or-later', use: 'facts-only' }],
    },
    collections: { use: [], deny: [] },
    platform: { windows: { status: 'documented', notes: 'Detection only' }, linux: { status: 'unknown' }, macos: { status: 'unknown' } },
    conflictingSoftware: ['Glorious CORE'],
    limitations: [
      'Detection only: UDB sends nothing to Glorious mice.',
      GEN_NOTE[gen],
      'No setting can be read back, so none could be write-verified. The mice keep several profiles and cannot report which one is active.',
      'Identified by VID/PID through “Identify another device”; UDB requests no Glorious interface.',
      `Generated from ${SOURCE}.`,
    ],
    features: [
      {
        id: 'dpi',
        kind: 'range',
        location: 'device',
        status: 'unsupported',
        evidence: [{ source: `${SOURCE}: DPI stage commands`, hardware: null, date: DATE, confidence: 'low', notes: 'OpenMouse knows no read of any Glorious setting; see docs/protocols/glorious.md' }],
      },
      {
        id: 'polling-rate',
        kind: 'enum',
        location: 'device',
        status: 'unsupported',
        evidence: [{ source: `${SOURCE}: polling-rate commands`, hardware: null, date: DATE, confidence: 'low', notes: 'Write-only; see docs/protocols/glorious.md' }],
      },
    ],
  };
  writeFileSync(join(dir, `${slug(model)}.json`), JSON.stringify({ $schema: '../../schema/device.schema.json', ...entry }, null, 2) + '\n');
}
console.log(`Generated ${MODELS.length} Glorious entries from ${seen.size} product IDs`);
