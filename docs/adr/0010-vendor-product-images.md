# 10. Vendor product images

Status: accepted, 2026-10-19 (owner decision). Replaces the PRODUCT.md and
DESIGN.md rule "never redistribute vendor logos or product photos".

## Context
The Phase 7 redesign shows the connected device as a large product image, as
vendor apps do (Pulsar's BBB, the Redragon launcher). UDB has no images of its
own. The options were authored silhouettes, a photo the user supplies,
vendor images bundled with the app, or vendor images loaded from vendor CDNs at
runtime. Loading from a vendor at runtime would tell the vendor which devices a
user owns and needs `img-src` opened to other origins, which breaks THREAT_MODEL
T6 and ADR 5. The owner chose to bundle vendor images.

## Decision
- `npm run import:images` (`scripts/import-images.ts`) fetches the vendors'
  own product images: ATK HUB's bundled cutouts, Razer's images as linked by
  OpenRazer (`DEVICE_IMAGE`, matched by USB PID), and the product JSON of the
  Pulsar, VXE, ATK, Glorious and Mechlands stores. Headless Chromium resizes
  them to 640 px, cuts out flat light backdrops, drops detached labels, trims
  them and encodes them as WebP into `public/devices/`. Only images that end up
  with a transparent background ship.
- `registry/images.json` records, per file, the source URL, the product page,
  the publisher, the retrieval date, the SHA-256 of the source and of the
  output, and whether the cutout is the vendor's or automatic. Per registry
  entry it records the file and the match: `model` (this product) or `line`
  (the same shell or product line, not this exact variant).
- Images are served from the app's own origin. `img-src 'self'` is unchanged,
  and no request reaches a vendor at runtime.
- The service worker does not precache `devices/`; an image is cached when it
  is first shown.
- An image is decoration. It never stands for support: status, identity and
  read-back are unchanged, and a `line` image is labelled as representative.
- Entries without an image fall back to a drawing of their category.

## Consequences
- The images are the vendors' copyrighted material and are not covered by
  UDB's licence, and the README says so. If a vendor objects, removing
  its rule from the script and re-running it removes its images.
- Logitech, SteelSeries, Corsair, HyperX, ROCCAT, ASUS and Wooting have no
  image source yet (coverage in `registry/images.json`).
- Re-running the script can change files when a vendor changes its images; the
  digests show what changed.
