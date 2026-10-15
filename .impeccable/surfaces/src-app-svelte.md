---
version: 1
slug: "src-app-svelte"
primary_target: "src/App.svelte"
related_targets: []
---

# Surface: UDB control center (app shell)

Mode: Operate. Audience, job and states: see `docs/design.md` (approved 2026-10-15).

## Direction contract

THESIS: The device's word is the only truth on screen. Every reading pairs what the user asked for with what the hardware reported back; refuses the gaming-dashboard default of glowing cards that echo the requested value as if applied.

OWN-WORLD: Warm graphite ground (light theme: warm off-white), calibration-certificate typography: system UI stack, tabular figures, small all-caps tags (DEVICE / BROWSER / COMPANION), hairline rules instead of cards. One signal amber for "needs attention", a calm green-grey for "confirmed". Authored SVG glyphs at one stroke weight.

STORY: The visitor sees every granted device and its state at a glance, opens one, and trusts what they read because unverified things say so.

FIRST VIEWPORT: Top bar (wordmark left, "Add device" primary button right). Left rail: device list with state words. Right pane: selected device header (model, connection, identity) then a readings table of registry capabilities with status tags. Empty state: one centred action with the permission explanation.

FORM: pinned by owner (precision instrument × industrial minimalism); no concept-seed roll; translated per mode-operate (type, palette, density, one signature move: the read-back line).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
