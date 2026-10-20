# Deploying UDB

UDB is a static site. GitHub Actions (`.github/workflows/ci.yml`) checks, tests
and builds every push and PR; a push to `main` uploads `dist/` and deploys it
to GitHub Pages. It is served at **<https://udb.lorenzmalabanan.com>**
(ADR 6, amended by ADR 12).

## What the build produces

`npm run build` writes `dist/`:

- the client bundle (`assets/`), with the CSP as a meta tag (ADR 5);
- the public pages, server-rendered with their own heads (ADR 12):
  `index.html` (the landing), `terms/index.html`, `contact/index.html`;
- `sw.js`, the service worker, written last so it precaches the pages too (ADR 9);
- from `public/`: `CNAME`, `robots.txt`, `sitemap.xml`, `og.png`, `404.html`,
  the manifest, icons, fonts, brand art and product images.

The app itself stays behind hashes on `/` (`/#/app`, `/#/device/…`,
`/#/supported`, `/#/profiles`), so it needs no server routing. Old
`/#/terms` and `/#/contact` links redirect to the new paths. Any other path
gets GitHub Pages' `404.html`.

## One-time setup (owner only)

These need the owner's DNS and GitHub accounts; nothing in the repo can do them.

1. **DNS.** At the DNS host for `lorenzmalabanan.com`, add:

   | Type | Name | Value |
   |---|---|---|
   | `CNAME` | `udb` | `e1ywrites.github.io` |

   Don't add a wildcard (`*.lorenzmalabanan.com`) record pointing at GitHub.
2. **Verify the domain** so nobody else's Pages site can claim it (subdomain
   takeover, THREAT_MODEL T15). GitHub → your profile **Settings → Pages →
   Add a domain** → `lorenzmalabanan.com`, then add the `TXT` record GitHub shows
   (`_github-pages-challenge-e1ywrites.lorenzmalabanan.com`) and press
   **Verify**. Verifying the parent domain also covers `udb.`.
3. **Set the custom domain.** Repository **Settings → Pages**: source
   **GitHub Actions** (already set), custom domain `udb.lorenzmalabanan.com`,
   **Save**, and wait for the DNS check to pass. Then tick **Enforce HTTPS**
   once GitHub has issued the certificate (usually within an hour; it can take
   up to a day). WebHID only works over HTTPS.
4. **Private vulnerability reporting.** Repository **Settings → Security** (Code
   security) → enable **Private vulnerability reporting**, so the Contact page's
   security link works.
5. **Search Console (optional).** Add the site at
   <https://search.google.com/search-console> (a Domain property, verified by DNS
   `TXT`, covers every URL), then submit `https://udb.lorenzmalabanan.com/sitemap.xml`
   under **Sitemaps**.

With an Actions deploy, the repository setting is what binds the domain;
GitHub doesn't read `public/CNAME` from the artifact. The file stays as a
record of the domain, and `tests/prerender.test.ts` keeps it in step with the
canonical URLs.

## Release checklist

Before merging to `main`:

- [ ] `npm run check`, `npm test` and `npm run build` pass (CI runs them too).
- [ ] `dist/` holds `index.html`, `terms/index.html` and `contact/index.html`,
      each with its text in the HTML (view source, not the inspector), plus
      `CNAME`, `robots.txt`, `sitemap.xml` and `og.png`.
- [ ] `npm run preview`: `/`, `/terms/` and `/contact/` load with no console
      errors; `/#/app` opens the app; `/#/terms` goes to `/terms/`.
- [ ] The device view works on the preview devices (`npm run dev`, `/?preview`),
      at desktop and phone width. Preview results are never hardware evidence.

After the deploy:

- [ ] <https://udb.lorenzmalabanan.com> loads over HTTPS with a valid
      certificate, and `http://` redirects to it.
- [ ] Adding a real device in Chrome or Edge works (the HTTPS secure context is
      what WebHID needs).
- [ ] A link to the site previews with the card (for example in a chat app, or
      a social network's link inspector).
- [ ] Google's Rich Results Test sees the `SoftwareApplication` data on `/`.

## When pages change

- **A new public page:** add it to `PAGES` in `src/prerender.ts` and `PATHS` in
  `src/App.svelte`, and its URL to `public/sitemap.xml`. The prerender test
  fails until the sitemap matches.
- **A title or description:** edit `PAGES` in `src/prerender.ts`; keep titles
  under about 60 characters and descriptions under about 160.
- **The brand or the cover's look:** regenerate the link preview image.

### Link preview image

`public/og.png` (1200×630) is a screenshot of `docs/og/card.html`, the booklet
cover at card size. It was made on 2026-10-20 with Playwright 1.62 (Chromium)
from the committed card, Fredoka and Dee (ADR 11), and nothing else. To
regenerate it (a one-off; Playwright isn't a project dependency):

```bash
npx -y playwright@1.62.1 install chromium
npx -y playwright@1.62.1 screenshot --viewport-size "1200, 630" --wait-for-timeout 500 "file://$PWD/docs/og/card.html" public/og.png
```

Link previews are cached by the sites that show them, so a new image can take
days to appear everywhere.
