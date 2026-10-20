# 9. Install and offline support (service worker)

Status: accepted, 2026-10-18

## Context
UDB makes no network calls after it loads (ADR 5), so it can run offline once
its files are cached, and be installed as an app window. A service worker caches
JavaScript, and that touches THREAT_MODEL T1: a compromised bundle that gets
cached keeps running until something replaces it.

## Decision
- A web manifest and icons make the site installable. `display: standalone`,
  scope and start URL relative to where it is hosted (the domain root since
  ADR 12).
- `vite build` writes `sw.js` from the files in `dist/`, with a cache name that
  changes every commit (`scripts/service-worker.ts`).
- **Install** precaches every build file, so one visit is enough for offline use.
- **Navigations go to the network first.** A reload fetches the current page
  after every deploy; the cached page answers only when the network doesn't.
  A rolled-back or fixed deploy reaches users on their next load, not their next
  reinstall.
- **Other same-origin GETs are cache first** (build files are content-hashed).
- **Cross-origin requests and non-GETs are never touched.** `connect-src 'self'`
  still holds.
- **No `skipWaiting` and no `clients.claim`.** A new worker takes over when the
  old one's tabs close, never in the middle of a session that may be writing to
  a device.
- Old `udb-*` caches are deleted on activation.
- The worker is registered in production builds only.

## Consequences
- The app opens offline after one visit. WebHID still needs a secure context,
  which an installed app keeps.
- T1 is unchanged in kind and slightly better in practice: caching adds no new
  way to send reports, and a reload always asks the network for the page.
  Users who want to drop cached code can clear the site's data or uninstall the
  app.
- Self-hosters get the same worker, scoped to wherever they serve the build.
- `tests/service-worker.test.ts` runs the generated worker against a fake scope.
