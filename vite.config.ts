/// <reference types="vitest/config" />
import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

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

export default defineConfig({
  base: './',
  define: { __COMMIT__: JSON.stringify(commit()) },
  plugins: [svelte(), csp],
  build: { assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
