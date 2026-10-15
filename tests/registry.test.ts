import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { registry } from '../src/lib/registry.ts';

const root = join(import.meta.dirname, '..');
const read = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'));

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(read('registry/schema/device.schema.json'));

describe('registry', () => {
  it.each(registry.map((e) => [e.id, e]))('%s matches the schema', (_id, entry) => {
    expect(validate(entry), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });

  it.each(registry.map((e) => [e.id, e]))('%s lives at registry/devices/<id>.json and its protocol doc exists', (id, entry) => {
    expect(existsSync(join(root, `registry/devices/${id}.json`))).toBe(true);
    expect(existsSync(join(root, entry.protocol.doc))).toBe(true);
  });

  it('has unique ids', () => {
    const ids = registry.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The schema is what stops a false "verified" claim. Prove it rejects the known-bad cases.
  const invalidDir = 'registry/schema/invalid';
  it.each(readdirSync(join(root, invalidDir)))('rejects %s', (file) => {
    expect(validate(read(`${invalidDir}/${file}`))).toBe(false);
  });
});
