// The public pages, rendered to HTML at build time (scripts/prerender.ts, ADR 12)
// so search engines and link previews see real content. Each gets its own head;
// the browser then hydrates the same markup (src/main.ts).
import { render } from 'svelte/server';
import App from './App.svelte';

export const SITE = 'https://udb.lorenzmalabanan.com';

export type Page = { path: string; title: string; description: string };

export const PAGES: Page[] = [
  {
    path: '/',
    title: 'UDB · Mouse, keyboard and headset settings in your browser',
    description:
      'Change DPI, polling rate, lighting and keys from Chrome or Edge, and see only what the device sends back. Free and open source, no install, nothing uploaded.',
  },
  {
    path: '/terms/',
    title: 'Terms of use · UDB',
    description:
      'UDB is free software that runs only in your browser. What it does with your devices and your data, and the licence it ships under.',
  },
  {
    path: '/contact/',
    title: 'Contact · UDB',
    description:
      'Report a bug, ask for your device, help verify a setting or report a security problem. UDB is run in the open on GitHub.',
  },
];

const esc = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

/** A data block, never executed, so the CSP's script-src doesn't apply to it. */
function jsonLd(page: Page): string {
  const app = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'UDB · Universal Driver Bus',
    alternateName: 'UDB',
    url: `${SITE}/`,
    description: page.description,
    image: `${SITE}/og.png`,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'Windows, macOS, Linux',
    browserRequirements: 'Chrome or Edge on a computer (WebHID)',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    license: 'https://www.gnu.org/licenses/gpl-3.0.html',
  };
  return `<script type="application/ld+json">${JSON.stringify(app).replaceAll('<', '\\u003c')}</script>`;
}

export function headFor(page: Page): string {
  const url = SITE + page.path;
  const [title, description] = [esc(page.title), esc(page.description)];
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="UDB" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE}/og.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="UDB, the Universal Driver Bus, with its mascot Dee" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${SITE}/og.png" />`,
    ...(page.path === '/' ? [jsonLd(page)] : []),
  ].join('\n    ');
}

/** The built index.html with this page's head and server-rendered body. */
export function pageHtml(template: string, page: Page): string {
  const { head, body } = render(App, { props: { url: page.path } });
  if (!/<title>[^<]*<\/title>/.test(template) || !template.includes('<div id="app"></div>')) {
    throw new Error('index.html is missing its <title> or <div id="app"></div>');
  }
  return template
    .replace(/<title>[^<]*<\/title>/, () => headFor(page) + head)
    .replace('<div id="app"></div>', () => `<div id="app">${body}</div>`);
}
