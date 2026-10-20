// ADR 12: after the client build, server-render the public pages into dist/.
// Called from vite.config.ts before the service worker lists the build, so the
// pages are precached too. The server bundle goes under node_modules/ so it
// resolves svelte from there, and never ships.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

export async function prerender(outDir: string): Promise<string[]> {
  const ssrDir = resolve('node_modules/.udb-prerender');
  await build({ logLevel: 'warn', publicDir: false, build: { ssr: 'src/prerender.ts', outDir: ssrDir, emptyOutDir: true } });
  const { PAGES, pageHtml } = (await import(pathToFileURL(join(ssrDir, 'prerender.js')).href)) as typeof import('../src/prerender.ts');
  const template = readFileSync(join(outDir, 'index.html'), 'utf8');
  return PAGES.map((page) => {
    const dir = join(outDir, page.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), pageHtml(template, page));
    return page.path;
  });
}
