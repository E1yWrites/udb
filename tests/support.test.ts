import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { registry } from '../src/lib/registry.ts';
import { renderSupportMarkdown } from '../src/lib/support.ts';

it('SUPPORT.md is generated from the current registry (run `npm run support`)', () => {
  const onDisk = readFileSync(join(import.meta.dirname, '..', 'SUPPORT.md'), 'utf8');
  expect(onDisk).toBe(renderSupportMarkdown(registry));
});
