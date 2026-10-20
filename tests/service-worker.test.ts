import { describe, expect, it } from 'vitest';
import { serviceWorkerSource } from '../scripts/service-worker.ts';

// Runs the generated worker against a fake scope: a Map of caches, a network
// that can be switched off, and the events the worker listens for.
function boot(version: string, files: string[], seed: Record<string, Map<string, string>> = {}) {
  const stores = new Map(Object.entries(seed));
  let online = true;
  const network = new Map<string, string>([['https://udb.test/', 'html-new'], ['https://udb.test/assets/a.js', 'js']]);
  const handlers: Record<string, (e: any) => void> = {};
  const key = (r: string | { url: string }) => new URL(typeof r === 'string' ? r : r.url, 'https://udb.test/').href;
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name)!;
      return {
        addAll: async (list: string[]) => list.forEach((f) => store.set(key(f), `cached:${f}`)),
        put: async (r: string | { url: string }, res: { body: string }) => void store.set(key(r), res.body),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (r: string | { url: string }) => {
      for (const store of stores.values()) if (store.has(key(r))) return { ok: true, body: store.get(key(r))!, clone() { return this; } };
      return undefined;
    },
  };
  const fetchFn = async (r: { url: string }) => {
    if (!online) throw new TypeError('offline');
    return { ok: true, body: network.get(r.url) ?? 'net', clone() { return this; } };
  };
  const self = { location: { origin: 'https://udb.test' }, addEventListener: (t: string, h: (e: any) => void) => void (handlers[t] = h) };
  new Function('self', 'caches', 'fetch', serviceWorkerSource(version, files))(self, caches, fetchFn);
  const run = async (type: string, event: object = {}) => {
    let done: Promise<unknown> = Promise.resolve();
    let answer: Promise<any> | undefined;
    handlers[type]!({ ...event, waitUntil: (p: Promise<unknown>) => (done = p), respondWith: (p: Promise<any>) => (answer = p) });
    await done;
    return answer ? await answer : undefined;
  };
  const request = (url: string, extra: object = {}) => ({ method: 'GET', mode: 'cors', url: `https://udb.test${url}`, ...extra });
  return { stores, run, request, go: (v: boolean) => (online = v) };
}

describe('service worker (ADR 9)', () => {
  const files = ['./', 'terms/', 'assets/a.js'];

  it('precaches every build file on install', async () => {
    const sw = boot('abc', files);
    await sw.run('install');
    expect([...sw.stores.get('udb-abc')!.keys()]).toEqual(['https://udb.test/', 'https://udb.test/terms/', 'https://udb.test/assets/a.js']);
  });

  it('on activate deletes older UDB caches and nothing else', async () => {
    const sw = boot('new', files, { 'udb-old': new Map(), 'udb-new': new Map(), 'other-app': new Map() });
    await sw.run('activate');
    expect([...sw.stores.keys()].sort()).toEqual(['other-app', 'udb-new']);
  });

  it('serves assets from the cache, offline too', async () => {
    const sw = boot('abc', files);
    await sw.run('install');
    sw.go(false);
    expect((await sw.run('fetch', { request: sw.request('/assets/a.js') })).body).toBe('cached:assets/a.js');
  });

  it('serves the page from the network when online, and the cached page when offline', async () => {
    const sw = boot('abc', files);
    await sw.run('install');
    expect((await sw.run('fetch', { request: sw.request('/', { mode: 'navigate' }) })).body).toBe('html-new');
    sw.go(false);
    expect((await sw.run('fetch', { request: sw.request('/', { mode: 'navigate' }) })).body).toBe('html-new');
  });

  it('keeps each page under its own URL, and falls back to the cover for an unknown one offline', async () => {
    const sw = boot('abc', files);
    await sw.run('install');
    await sw.run('fetch', { request: sw.request('/', { mode: 'navigate' }) });
    await sw.run('fetch', { request: sw.request('/terms/', { mode: 'navigate' }) });
    sw.go(false);
    expect((await sw.run('fetch', { request: sw.request('/', { mode: 'navigate' }) })).body).toBe('html-new');
    expect((await sw.run('fetch', { request: sw.request('/terms/', { mode: 'navigate' }) })).body).toBe('net');
    expect((await sw.run('fetch', { request: sw.request('/nowhere/', { mode: 'navigate' }) })).body).toBe('html-new');
  });

  it('leaves cross-origin requests and non-GETs alone', async () => {
    const sw = boot('abc', files);
    expect(await sw.run('fetch', { request: { method: 'GET', mode: 'cors', url: 'https://elsewhere.test/x.js' } })).toBeUndefined();
    expect(await sw.run('fetch', { request: sw.request('/assets/a.js', { method: 'POST' }) })).toBeUndefined();
  });

  it('never activates early: no skipWaiting or clients.claim', () => {
    const source = serviceWorkerSource('abc', files);
    expect(source).not.toContain('skipWaiting');
    expect(source).not.toContain('clients.claim');
  });
});
