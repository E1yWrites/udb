---
version: 1
slug: "src-app-svelte"
primary_target: "src/App.svelte"
related_targets: ["src/ui/DevicePane.svelte","src/ui/SettingLine.svelte"]
---

# Surface: UDB control center (app shell)

Mode: Operate. Audience, job and states: see `docs/design.md` (approved 2026-10-15). Brand: PRODUCT.md (Phase 8, green/yellow, Dee). Home is the landing page (owner decision 2026-10-19); this brief covers the device view.

## Direction contract

THESIS: The open device is a cartridge pushed into the console; its neighbours wait in the rack; its settings are printed on the booklet's next page, one dotted row each, and only the one you're editing opens. Refuses the launcher default of a sidebar of devices beside a long form, and any value shown that the device didn't return.

OWN-WORLD: The booklet (Phase 8): cover-green plate with a band keyline, Dee-yellow cartridge label, paper sheet with an ink keyline and dotted rules, "p. 2" chip, Fredoka for names, tabs and pills, band top bar and dock. Teal confirmed, orange attention. Product cutouts or category drawings on the label.

STORY: The visitor opens a device from Home, sees its cartridge in the slot with identity and status, reads it, opens one row, changes it, watches the device's value settle, swaps to the next cartridge with an arrow key, the rack or the dock.

FIRST VIEWPORT: Band top bar with Identify, Add device and Close. Left: the console (rack ‹ cartridge › rack), then the index tabs and the top of the printed page. Right: the status notice, Dee's tip, the facts card. Bottom: the band dock of device pills, the open one yellow.

FORM: surface roll e95cb58a, comp A · Cartridge (`.impeccable/mocks/decision/v1-cartridge.png`), owner pick 2026-10-20. Values on closed rows keep full contrast; the printed page is paper in both themes.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
