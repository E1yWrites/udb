import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAGES, SITE, pageHtml } from '../src/prerender.ts';

// ADR 12: the public pages are server-rendered into the built index.html.
const template = readFileSync('index.html', 'utf8');
const html = Object.fromEntries(PAGES.map((p) => [p.path, pageHtml(template, p)]));
const one = (s: string, re: RegExp) => s.match(re)?.[1];

describe('prerendered public pages (ADR 12)', () => {
  it.each([
    ['/', 'cover-title', 'Universal Driver Bus'],
    ['/terms/', 'info-title', 'Terms of use'],
    ['/contact/', 'info-title', 'Contact'],
  ])('%s renders its own heading, title and canonical', (path, id, heading) => {
    const page = html[path]!;
    expect(page).toContain(`<h1 id="${id}"`);
    expect(page.match(/<h1\b/g)).toHaveLength(1);
    expect(one(page, /<h1[^>]*>([\s\S]*?)<\/h1>/)).toContain(heading);
    expect(page.match(/<title>/g)).toHaveLength(1);
    expect(one(page, /<title>([^<]*)<\/title>/)).toBe(PAGES.find((p) => p.path === path)!.title);
    expect(one(page, /<link rel="canonical" href="([^"]*)"/)).toBe(SITE + path);
    expect(one(page, /<meta property="og:image" content="([^"]*)"/)).toBe(`${SITE}/og.png`);
    expect(page).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it('leaks no device or app markup into a public page', () => {
    for (const page of Object.values(html)) {
      expect(page).not.toContain('device-title');
      expect(page).not.toContain('class="dock');
      expect(page).not.toContain('role="tabpanel"');
      expect(page).not.toContain('id="home-title"');
    }
  });

  it('shows the cover without WebHID as the browser hint, never the insecure-page warning', () => {
    expect(html['/']).toContain('only Chrome and Edge on a computer have');
    expect(html['/']).not.toContain('Devices only connect on a secure page');
  });

  it('describes the app with JSON-LD on the landing only', () => {
    const ld = one(html['/']!, /<script type="application\/ld\+json">([^<]*)<\/script>/);
    expect(JSON.parse(ld!)).toMatchObject({ '@type': 'SoftwareApplication', url: `${SITE}/`, offers: { price: '0' } });
    expect(html['/terms/']).not.toContain('application/ld+json');
  });

  it('lists exactly the public pages in the sitemap', () => {
    const locs = [...readFileSync('public/sitemap.xml', 'utf8').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(PAGES.map((p) => SITE + p.path));
    expect(readFileSync('public/robots.txt', 'utf8')).toContain(`Sitemap: ${SITE}/sitemap.xml`);
    expect(readFileSync('public/CNAME', 'utf8').trim()).toBe(new URL(SITE).host);
  });
});
