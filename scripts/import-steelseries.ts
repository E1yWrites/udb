// Generates the detection-only SteelSeries mouse entries in
// registry/devices/steelseries/ from OpenMouse's per-PID table
// (third_party/openmouse/steelseries-devices.ts, AGPL-3.0-or-later, ADR 8): one
// entry per model, one identity per product ID. Run with
// `npm run import:steelseries`, then `npm run support`. The Arctis headset entry
// is hand-written and stays; only files whose family is `steelseries-mouse` are
// replaced. No adapter exists: UDB sends these mice nothing
// (docs/protocols/steelseries-mouse.md).
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STEELSERIES_PRODUCTS, STEELSERIES_VENDOR_ID } from '../third_party/openmouse/steelseries-devices.ts';
import type { Connection, DeviceEntry, Identity } from '../src/lib/registry.ts';

const root = new URL('..', import.meta.url).pathname;
const dir = join(root, 'registry/devices/steelseries');
const DATE = '2026-10-18';
const SOURCE = 'OpenMouse mouse-protocol @54c68c69: src/steelseries/devices.ts (third_party/openmouse/steelseries-devices.ts), traced there to rivalcfg and the vendor’s GG specification';
const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}` as const;
const slug = (s: string) => s.toLowerCase().replace(/\+/g, ' plus').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The mode suffix OpenMouse appends to a model name says how the PID connects.
const MODE = /\s*\((wired mode|2\.4 GHz mode|2\.4 GHz wireless mode|base station|dongle)\)$/;
const connectionOf = (model: string, wireless: boolean): Connection => {
  const m = MODE.exec(model)?.[1];
  if (m === 'wired mode') return 'wired';
  if (m) return 'dongle';
  return wireless ? 'unknown' : 'wired';
};

const groups = new Map<string, Identity[]>();
for (const [pid, p] of STEELSERIES_PRODUCTS) {
  const model = p.model.replace(MODE, '');
  const notes = [
    `OpenMouse codec family “${p.family}”.`,
    p.verified ? 'OpenMouse reports this PID exercised on its hardware (third-party, not UDB evidence).' : '',
  ].filter(Boolean);
  groups.set(model, [...(groups.get(model) ?? []), { vid: hex(STEELSERIES_VENDOR_ID), pid: hex(pid), connection: connectionOf(p.model, p.wireless), notes: notes.join(' ') }]);
}

for (const f of readdirSync(dir)) {
  const p = join(dir, f);
  if (JSON.parse(readFileSync(p, 'utf8')).protocol?.family === 'steelseries-mouse') unlinkSync(p);
}

const ids = new Set<string>();
for (const [model, identities] of groups) {
  const id = `steelseries/${slug(model)}`;
  if (ids.has(id)) throw new Error(`duplicate entry id ${id}`);
  ids.add(id);
  const evidence = (what: string) => [{ source: `${SOURCE}: ${what}`, hardware: null, date: DATE, confidence: 'low' as const, notes: 'OpenMouse lists no settings getter for any SteelSeries family; see docs/protocols/steelseries-mouse.md' }];
  const entry: DeviceEntry = {
    id,
    vendor: 'SteelSeries',
    model,
    category: 'mouse',
    identities,
    protocol: {
      family: 'steelseries-mouse',
      doc: 'docs/protocols/steelseries-mouse.md',
      references: [
        { title: 'OpenMouse mouse-protocol (SteelSeries product table, hardware notes)', url: 'https://github.com/OpenMouse-Project/mouse-protocol', license: 'AGPL-3.0-or-later', use: 'facts-only' },
        { title: 'rivalcfg', url: 'https://github.com/flozz/rivalcfg', license: 'WTFPL', use: 'facts-only' },
      ],
    },
    collections: { use: [], deny: [] },
    platform: { windows: { status: 'documented', notes: 'Detection only' }, linux: { status: 'unknown' }, macos: { status: 'unknown' } },
    conflictingSoftware: ['SteelSeries GG', 'SteelSeries Engine'],
    limitations: [
      'Detection only: UDB sends nothing to SteelSeries mice.',
      'DPI, polling rate, lighting and buttons cannot be read back on any SteelSeries family OpenMouse covers, so they could never be write-verified.',
      'Each codec family has its own command set; one family’s commands would misprogram another’s mice.',
      'Identified by VID/PID through “Identify another device”; UDB requests no SteelSeries interface.',
      `Generated from ${SOURCE}.`,
    ],
    features: [
      { id: 'dpi', kind: 'range', location: 'device', status: 'unsupported', evidence: evidence('per-family DPI command') },
      { id: 'polling-rate', kind: 'enum', location: 'device', status: 'unsupported', evidence: evidence('per-family polling-rate command') },
    ],
  };
  writeFileSync(join(dir, `${slug(model)}.json`), JSON.stringify({ $schema: '../../schema/device.schema.json', ...entry }, null, 2) + '\n');
}
console.log(`Generated ${groups.size} SteelSeries mouse entries from ${STEELSERIES_PRODUCTS.size} product IDs`);
