# 11. Brand assets, mascot and display font

Status: accepted, 2026-10-19 (owner decision, Phase 8).

## Context
The owner supplied the UDB mascot, Dee (a USB stick in a green cap), a
wordmark and an app icon, and asked for a green and yellow theme throughout,
a light/dark switch and a mascot guide. The wordmark's lettering is a chunky
rounded face; the UI used the system font with no web fonts.

## Decision
- The owner's images are UDB's own assets: `public/brand/dee.webp`,
  `public/brand/logo.webp`, and the PWA icons and favicon in `public/icons/`,
  generated from the supplied files (already transparent; trimmed and resized
  with ImageMagick). The old `public/icon.svg` is removed.
- Fredoka (SIL OFL 1.1), latin subset, variable weight, is vendored in
  `public/fonts/` with its licence and digest in `third_party/fredoka/`. It is
  used for headings, the wordmark and Dee's speech bubbles only; body text and
  numbers stay on the system UI font.
- Everything is served from UDB's own origin and precached by the service
  worker. No font service or CDN is contacted, so ADR 5 and the CSP stand
  (`font-src` falls back to `default-src 'self'`).
- The theme choice (System, Light, Dark) is a viewer preference kept in
  `localStorage` (`udb-theme`, `src/lib/prefs.svelte.ts`), applied before the
  app mounts. It is never a device setting.

## Consequences
- About 30 KB of font and 70 KB of brand images join the install.
- Dee has one pose. More poses replace CSS variations when the owner provides them.
