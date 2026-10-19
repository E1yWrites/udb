---
version: 1
slug: "src-app-svelte"
primary_target: "src/App.svelte"
related_targets: ["src/ui/DevicePane.svelte","src/ui/SettingLine.svelte"]
---

# Surface: UDB control center (app shell)

Mode: Operate. Audience, job and states: see `docs/design.md` (approved 2026-10-15). Brand: PRODUCT.md (Phase 8, green/yellow, Dee). Home is the landing page (owner decision 2026-10-19); this brief covers the device view.

## Direction contract

THESIS: One device in focus, lit on its stage, with its neighbours waiting dimmed at the edges; settings are tiles and only the one you're editing opens. Refuses the launcher default of a sidebar of devices beside a long form, and any value shown that the device didn't return.

OWN-WORLD: Phase 8 tokens: green-tinted dark shell, grass-green accent, Dee yellow for the focused tile and the current dock pill, teal confirmed, orange attention. Fredoka for names, pills, 18px tiles, a radial stage light with a floor shadow, product cutouts or category drawings.

STORY: The visitor opens a device from Home, sees it large with identity and status, reads it, opens one tile, changes it, watches the device's value settle, steps to the next device with an arrow key or the dock.

FIRST VIEWPORT: Top bar. Left column: category and position ("Mouse · 2 of 4"), display-size name, identity chips, status, Dee's tip. Centre: the device image large on the stage, previous and next devices dimmed and small on either side as buttons. Below: tab control, then the tile row with the first tile open. Bottom: a sticky dock of device pills.

FORM: surface roll 24d6e104, re-roll 1, card E (streaming-wall raise: the focused tile lifts and opens, the rest stay closed). Values on closed tiles keep full contrast; only their chrome dims.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
