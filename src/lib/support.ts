import type { DeviceEntry, Evidence } from './registry.ts';

const CATEGORY_TITLES = { mouse: 'Mice', keyboard: 'Keyboards', headset: 'Headsets' } as const;

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

function latest(evidence: Evidence[]): Evidence | undefined {
  return [...evidence].sort((a, b) => b.date.localeCompare(a.date))[0];
}

function describe(e: Evidence | undefined): string {
  if (!e) return '–';
  return `${e.hardware ?? 'no hardware'}, ${e.date}, ${e.confidence} confidence`;
}

/** True when any identity or feature carries evidence observed on real hardware. */
const seenOnHardware = (e: DeviceEntry) =>
  e.identities.some((id) => id.evidence?.some((ev) => ev.hardware)) || e.features.some((f) => f.evidence.some((ev) => ev.hardware));

function detailed(entry: DeviceEntry, out: string[]): void {
  out.push('', `### ${entry.vendor} ${entry.model}`, '');
  out.push(`Protocol: \`${entry.protocol.family}\` ([notes](${entry.protocol.doc}))`, '');
  out.push('| Identity | Connection | Detected by UDB |', '|---|---|---|');
  for (const id of entry.identities) {
    const name = id.productName ? ` "${id.productName}"` : '';
    const seen = id.evidence?.length ? describe(latest(id.evidence)) : 'not yet';
    out.push(`| \`${id.vid}:${id.pid}\`${cell(name)} | ${id.connection} | ${cell(seen)} |`);
  }
  out.push('', '| Feature | Location | Status | Read-back | Latest evidence |', '|---|---|---|---|---|');
  for (const f of entry.features) {
    const readBack = f.readBack === undefined ? '–' : f.readBack ? 'yes' : 'no';
    out.push(`| ${f.id} | ${f.location} | ${f.status} | ${readBack} | ${cell(describe(latest(f.evidence)))} |`);
  }
}

function compact(entries: DeviceEntry[], out: string[]): void {
  out.push('', '| Device | USB IDs | Protocol | Experimental | Not supported |', '|---|---|---|---|---|');
  for (const e of entries) {
    const ids = [...new Set(e.identities.map((id) => `${id.vid.slice(2)}:${id.pid.slice(2)}`))].join(' ');
    const by = (s: string) => e.features.filter((f) => f.status === s).map((f) => f.id).join(', ') || '–';
    out.push(`| ${cell(`${e.vendor} ${e.model}`)} | ${ids} | \`${e.protocol.family}\` | ${by('experimental')} | ${by('unsupported')} |`);
  }
}

/** SUPPORT.md, generated from the registry. tests/support.test.ts fails when the file is stale. */
export function renderSupportMarkdown(entries: DeviceEntry[]): string {
  const out: string[] = [
    '# Support matrix',
    '',
    'Generated from `registry/devices/` by `npm run support`. **Do not edit by hand.**',
    '',
    'Only `read-verified` and `write-verified` mean a result was observed on real hardware.',
    '`experimental` comes from static analysis, documentation or replay. `unsupported` means the',
    'device has the feature but UDB does not control it. `companion` features run on the PC and are',
    'never shown as device controls.',
  ];

  for (const [category, title] of Object.entries(CATEGORY_TITLES)) {
    const inCategory = entries.filter((e) => e.category === category);
    if (inCategory.length === 0) continue;
    out.push('', `## ${title}`);
    const tested = inCategory.filter(seenOnHardware);
    const untested = inCategory.filter((e) => !seenOnHardware(e));
    for (const entry of tested) detailed(entry, out);
    if (untested.length) {
      out.push('', `### Not yet seen on hardware by UDB (${untested.length})`);
      compact(untested, out);
    }
  }
  return out.join('\n') + '\n';
}
