// Generates registry/devices/razer/*.json from OpenMouse's Razer product table
// (third_party/openmouse/razer-devices.ts, AGPL-3.0-or-later, ADR 8): one entry
// per model, one identity per product ID with its protocol params. Run with
// `npm run import:razer`, then `npm run support`. Everything generated is
// experimental: nothing here has been verified on hardware by UDB.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAZER_PRODUCTS, type RazerProduct } from '../third_party/openmouse/razer-devices.ts';
import type { DeviceEntry, Feature, Identity } from '../src/lib/registry.ts';

const root = new URL('..', import.meta.url).pathname;
const DATE = '2026-10-15';
const SOURCE = 'OpenMouse mouse-protocol @e53af6d5: src/razer/devices.ts (third_party/openmouse/razer-devices.ts) and src/razer/codec.ts';
const hex = (n: number) => `0x${n.toString(16).toUpperCase().padStart(4, '0')}` as const;
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/\+/g, ' plus')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const evidence = (source: string, notes?: string) => [{ source, hardware: null, date: DATE, confidence: 'low' as const, ...(notes ? { notes } : {}) }];

function identity(pid: number, p: RazerProduct): Identity {
  const notes = [
    p.verified ? 'OpenMouse reports this connection tested on its hardware (third-party, not UDB evidence).' : '',
    p.nativeOnly ? 'OpenMouse reports Chrome strips the control channel’s feature reports on this connection, so no browser can reach it.' : '',
    p.transport === 'index3' ? 'OpenRazer reaches this model through USB control index 3; which HID collection carries it in a browser is unknown.' : '',
    p.probePollingRates ? 'A dock: the polling command follows the paired mouse; UDB uses the declared default.' : '',
  ].filter(Boolean);
  return {
    vid: '0x1532',
    pid: hex(pid),
    connection: p.wireless ? 'dongle' : 'wired',
    params: {
      transactionId: p.transactionId,
      polling: p.highRatePolling ? 'extended' : 'legacy',
      ...(p.extendedPollingCommitTransactionId !== undefined ? { pollingCommitTransactionId: p.extendedPollingCommitTransactionId } : {}),
      pollingRates: [...p.pollingRates],
      dpiStorage: p.dpiStorageByte ?? 1,
      maxDpi: p.maxDpi,
      battery: p.hasBattery,
      wireless: p.wireless,
    },
    ...(notes.length ? { notes: notes.join(' ') } : {}),
  };
}

function features(products: RazerProduct[]): Feature[] {
  const battery = products.some((p) => p.hasBattery);
  const maxDpi = Math.max(...products.map((p) => p.maxDpi));
  const rates = [...new Set(products.flatMap((p) => [...p.pollingRates]))].sort((a, b) => a - b);
  const f = (id: string, kind: Feature['kind'], status: Feature['status'], source: string, extra: Partial<Feature> = {}): Feature => ({
    id,
    kind,
    location: 'device',
    status,
    evidence: evidence(source),
    ...extra,
  });
  return [
    f('dpi', 'range', 'experimental', `${SOURCE}: 04/85, 04/05`, { readBack: true, constraints: { min: 100, max: maxDpi } }),
    f('polling-rate', 'enum', 'experimental', `${SOURCE}: 00/85, 00/05 or 00/C0, 00/40`, { readBack: true, constraints: { values: rates } }),
    ...(battery
      ? [
          f('battery', 'readonly', 'experimental', `${SOURCE}: 07/80, 07/84`, { readBack: true }),
          f('sleep-timeout', 'range', 'experimental', `${SOURCE}: 07/83, 07/03`, { readBack: true, constraints: { min: 60, max: 900, step: 60, unit: 's' } }),
          f('low-power-threshold', 'range', 'experimental', `${SOURCE}: 07/81, 07/01`, { readBack: true, constraints: { min: 5, max: 100, step: 5, unit: '%' } }),
        ]
      : []),
    f('dpi.stages', 'range', 'unsupported', `${SOURCE}: 04/86, 04/06`, { notes: 'The stage-table write is a fixed 38-byte block; planned for Phase 5' }),
    f('lift-off-distance', 'enum', 'unsupported', `${SOURCE}: class 0B`, { notes: 'Not provable per model without hardware (OpenMouse)' }),
    f('buttons', 'keymap', 'unsupported', `${SOURCE}: class 02`),
    f('lighting', 'color', 'unsupported', `${SOURCE}: classes 03, 0F`),
  ];
}

const groups = new Map<string, [number, RazerProduct][]>();
for (const [pid, p] of RAZER_PRODUCTS) {
  const model = p.model.replace(/\s*\(Wired\)$/, '');
  groups.set(model, [...(groups.get(model) ?? []), [pid, p]]);
}

const entries: DeviceEntry[] = [];
const ids = new Set<string>();
for (const [model, list] of groups) {
  let id = `razer/${slug(model)}`;
  if (ids.has(id)) id = `${id}-${list[0]![0].toString(16)}`;
  ids.add(id);
  const products = list.map(([, p]) => p);
  entries.push({
    id,
    vendor: 'Razer',
    model,
    category: 'mouse',
    identities: list.map(([pid, p]) => identity(pid, p)),
    protocol: {
      family: 'razer',
      doc: 'docs/protocols/razer.md',
      references: [
        { title: 'OpenMouse mouse-protocol (Razer codec, product table, captures)', url: 'https://github.com/OpenMouse-Project/mouse-protocol', license: 'AGPL-3.0-or-later', use: 'code' },
        { title: 'OpenRazer', url: 'https://github.com/openrazer/openrazer', license: 'GPL-2.0-or-later', use: 'facts-only' },
      ],
    },
    collections: {
      use: [
        {
          usagePage: '0x0001',
          usage: '0x0002',
          reportIds: [0],
          undeclaredFeatureReports: true,
          purpose: 'Control channel: 90-byte feature report 0 on the interface whose only collection is Generic Desktop Mouse; Razer does not declare it in the descriptor',
        },
      ],
      deny: [],
    },
    platform: {
      windows: { status: 'documented', notes: 'Target platform; not yet tested' },
      linux: { status: 'documented', notes: 'Needs a udev rule for hidraw' },
      macos: { status: 'documented', notes: 'The browser needs Input Monitoring permission to open mouse-class interfaces (OpenMouse)' },
    },
    conflictingSoftware: ['Razer Synapse'],
    limitations: [
      `Generated from ${SOURCE}.`,
      'Nothing here has been verified on hardware by UDB.',
      'Razer’s protocol is not self-describing: the transaction ID, polling command and DPI ceiling come from OpenMouse’s audit of OpenRazer, per product ID. A wrong transaction ID means the mouse does not answer; nothing is written.',
      'On a receiver, two interfaces can look identical; UDB tries each granted mouse interface until one answers.',
      'DPI stages, lift-off, button mapping and lighting are not implemented. The serial number is never read.',
    ],
    features: features(products),
  });
}

const dir = join(root, 'registry/devices/razer');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
for (const e of entries) writeFileSync(join(root, 'registry/devices', `${e.id}.json`), JSON.stringify({ $schema: '../../schema/device.schema.json', ...e }, null, 2) + '\n');
console.log(`Generated ${entries.length} Razer entries from ${RAZER_PRODUCTS.size} product IDs`);
