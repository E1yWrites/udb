---
version: 1
slug: "src-app-svelte"
primary_target: "src/App.svelte"
related_targets: ["src/ui/DevicePane.svelte","src/ui/DeviceArt.svelte"]
---

# Surface: UDB control center (app shell)

Mode: Operate. Audience, job and states: see `docs/design.md` (approved 2026-10-15). Redesigned in Phase 7 (owner-pinned launcher look, 2026-10-19).

## Direction contract

THESIS: The connected device stands lit on a stage, and everything around it is what the device reported back. Refuses the launcher default of echoing the requested value as applied, and its neon chrome.

OWN-WORLD: Deep ink-blue shell (cool steps rail < bg < surface < raised), one sky accent for selection and primary actions, amber for attention, green for confirmed. Pill buttons, 18px tiles, a radial stage light with a floor shadow, vendor cutouts or authored category drawings.

STORY: The visitor sees every granted device as a thumbnail, opens one, sees it on stage with its identity and status, reads it, changes one setting, and watches the device's own value settle in.

FIRST VIEWPORT: Translucent top bar (wordmark left; Identify another device, Add device right). Dock of device tiles left. Pane: stage (about 26rem image) beside the display-size name, identity chips and status notice; then the tab control with Controls first.

FORM: pinned by owner (references Pulsar BBB, Redragon launcher); no concept-seed roll; translated per mode-operate (type, palette, density, one signature move: the read-back settle).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
