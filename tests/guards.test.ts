import { expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const src = join(import.meta.dirname, '..', 'src');
const files = readdirSync(src, { recursive: true, encoding: 'utf8' }).filter((f) => /\.(ts|svelte)$/.test(f));

it('only the transport sends or requests HID reports (THREAT_MODEL T1/T2)', () => {
  const callers = files.filter(
    (f) => !['lib/transport.ts', 'lib/webhid.d.ts'].includes(f) &&
      /\b(sendReport|sendFeatureReport|receiveFeatureReport)\s*\(/.test(readFileSync(join(src, f), 'utf8')),
  );
  expect(callers).toEqual([]);
});

it('no component renders raw HTML, so device strings cannot inject markup (T8)', () => {
  const raw = files.filter((f) => f.endsWith('.svelte') && readFileSync(join(src, f), 'utf8').includes('{@html'));
  expect(raw).toEqual([]);
});
