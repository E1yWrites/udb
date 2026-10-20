# 12. Custom domain and prerendered public pages

Status: accepted, 2026-10-20 (owner decision, Phase 9). Amends ADR 6.

## Context
ADR 6 put UDB on GitHub Pages at the project path, with no custom domain until
the first release, and every view lived behind a `#` hash. Search engines and
link previews saw one empty page. The owner wants UDB on their own domain,
`udb.lorenzmalabanan.com`, with real search listings, and chose prerendered
pages over metadata-only changes.

## Decision
- UDB is served from the root of `udb.lorenzmalabanan.com` (Vite `base: '/'`,
  root-absolute asset paths). GitHub Pages still hosts it, deployed from `main`
  by Actions as in ADR 6; the domain is set in the repository's Pages settings
  and verified on the owner's account.
- The public pages are real paths: `/` (the landing), `/terms/` and
  `/contact/`. The build server-renders each one with `svelte/server` into its
  own `index.html` with its own title, description, canonical URL, Open Graph
  and Twitter tags (`src/prerender.ts`, `scripts/prerender.ts`). The landing
  also carries a JSON-LD `SoftwareApplication` data block, which the CSP
  doesn't execute.
- The browser hydrates that markup instead of mounting fresh. A server render
  has no WebHID, so the cover shows its "open in Chrome or Edge" variant; the
  browser corrects it when it has WebHID.
- The app stays behind hashes on `/` (`#/app`, `#/device/…`, `#/supported`,
  `#/profiles`): it has nothing to index, and hashes need no server routing.
  Old `#/terms` and `#/contact` links redirect to the new paths.
- `robots.txt` allows everything and names `sitemap.xml`, which lists the three
  pages. `og.png` is generated once from an HTML card (`docs/og/card.html`).
- The service worker caches each page under its own URL; an unknown page falls
  back to the cover offline (ADR 9).

## Consequences
- Search engines and link previews get real content per page; nothing extra is
  loaded at runtime, so ADR 5 and the CSP stand.
- A domain is something that can be taken over if the DNS record outlives the
  site; THREAT_MODEL T15 and `docs/deploy.md` cover verification.
- The build is a two-pass build (client, then a server bundle that never
  ships). Adding a public page means touching `PAGES`, `PATHS` and the sitemap;
  a test keeps the sitemap honest.
- Returning visitors still land in the app: `/` with no hash goes to `#/app`
  once the app has been opened in that browser.
