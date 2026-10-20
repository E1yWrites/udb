/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { serviceWorkerSource } from './scripts/service-worker.ts';

// ADR 5: strict CSP. Build only, because the dev server injects inline styles.
// GitHub Pages can't send headers, so it ships as a meta tag (no frame-ancestors).
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const csp: Plugin = {
  name: 'udb-csp',
  apply: 'build',
  transformIndexHtml: () => [
    { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
  ],
};

// ADR 8: the app is conveyed under AGPL-3.0 terms, so it links to the exact source it was built from.
function commit(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'main';
  }
}

// ADR 9: after the build, list dist/ and write sw.js with a per-commit cache name.
let outDir = 'dist';
const sw: Plugin = {
  name: 'udb-service-worker',
  apply: 'build',
  configResolved: (config) => void (outDir = config.build.outDir),
  closeBundle() {
    const files = readdirSync(outDir, { recursive: true, encoding: 'utf8' })
      .map((f) => f.replaceAll('\\', '/'))
      // Device photos (ADR 10) load when shown instead of in every install; 404.html is for GitHub Pages only.
      .filter((f) => !f.endsWith('/') && f !== 'sw.js' && f !== '404.html' && !f.startsWith('devices/') && /\.[a-z0-9]+$/i.test(f));
    writeFileSync(join(outDir, 'sw.js'), serviceWorkerSource(commit().slice(0, 12), ['./', ...files]));
  },
};

export default defineConfig({
  base: '/',
  define: { __COMMIT__: JSON.stringify(commit()) },
  plugins: [svelte(), csp, sw],
  build: { assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
