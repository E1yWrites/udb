// Writes SUPPORT.md from registry/devices/. Run with `npm run support`.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderSupportMarkdown } from '../src/lib/support.ts';
import type { DeviceEntry } from '../src/lib/registry.ts';

const root = new URL('..', import.meta.url).pathname;
const dir = join(root, 'registry/devices');
const entries = readdirSync(dir, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as DeviceEntry)
  .sort((a, b) => a.id.localeCompare(b.id));

writeFileSync(join(root, 'SUPPORT.md'), renderSupportMarkdown(entries));
console.log(`SUPPORT.md written (${entries.length} devices)`);
