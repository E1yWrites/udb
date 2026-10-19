import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { registry } from '../src/lib/registry.ts';
import { imageFor } from '../src/lib/images.ts';
import data from '../registry/images.json';

const root = join(import.meta.dirname, '..');

// ADR 10: every shipped image has a provenance record and the digest it was recorded with.
describe('device images', () => {
  const files = readdirSync(join(root, 'public/devices'));

  it('ships exactly the files registry/images.json describes, unchanged', () => {
    expect(files.sort()).toEqual(Object.keys(data.images).sort());
    for (const [file, meta] of Object.entries(data.images)) {
      const sha = createHash('sha256').update(readFileSync(join(root, 'public/devices', file))).digest('hex');
      expect(sha, file).toBe(meta.sha256);
      expect(meta.url, file).toMatch(/^https:\/\//);
      expect(meta.retrieved, file).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('maps only registry entries to images that exist', () => {
    const ids = new Set(registry.map((e) => e.id));
    for (const [id, d] of Object.entries(data.devices)) {
      expect(ids.has(id), id).toBe(true);
      expect(files, id).toContain(d.file);
      expect(['model', 'line']).toContain(d.match);
    }
  });

  it('resolves an entry to a same-origin path and nothing for unknown entries', () => {
    const img = imageFor('pulsar/x2-crazylight');
    expect(img?.src).toMatch(/^\/?(\.\/)?devices\/[\w-]+\.webp$/);
    expect(img?.match).toBe('model');
    expect(imageFor('nobody/nothing')).toBeNull();
    expect(imageFor(undefined)).toBeNull();
  });
});
