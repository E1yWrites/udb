---
name: UDB · Universal Driver Bus
description: One bus. Every device. A launcher that puts the connected device on a stage and shows only what it reported back.
colors:
  bg: "oklch(0.17 0.014 155)"
  rail: "oklch(0.15 0.013 155)"
  surface: "oklch(0.21 0.017 155)"
  raised: "oklch(0.255 0.02 152)"
  line: "oklch(0.32 0.018 152)"
  line-strong: "oklch(0.45 0.02 150)"
  text: "oklch(0.965 0.01 110)"
  muted: "oklch(0.8 0.018 135)"
  faint: "oklch(0.68 0.02 145)"
  accent: "oklch(0.74 0.16 145)"
  accent-ink: "oklch(0.18 0.04 150)"
  yellow: "oklch(0.88 0.17 92)"
  yellow-ink: "oklch(0.22 0.045 85)"
  signal: "oklch(0.78 0.15 58)"
  confirmed: "oklch(0.82 0.1 192)"
  danger: "oklch(0.73 0.16 25)"
  stage-light: "oklch(0.66 0.15 140 / 0.3)"
  light-bg: "oklch(0.975 0.014 105)"
  light-surface: "oklch(0.996 0.005 105)"
  light-text: "oklch(0.22 0.03 150)"
  light-accent: "oklch(0.5 0.14 148)"
  light-signal: "oklch(0.525 0.15 50)"
  light-confirmed: "oklch(0.48 0.09 200)"
typography:
  display:
    fontFamily: "'Fredoka', 'Segoe UI Variable Display', system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.6rem + 2.2vw, 3.5rem)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.01em"
  value:
    fontFamily: "'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 650
    letterSpacing: "-0.01em"
  body:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  tag:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 650
    letterSpacing: "0.08em"
  data:
    fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "0.92em"
rounded:
  control: "10px"
  tile: "18px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
  "12": "48px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 16px"
  button:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 16px"
  dock-item-current:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.tile}"
    padding: "8px"
  setting-tile:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.tile}"
    padding: "16px"
---

# Design System: UDB

## Overview

UDB is its own instruction booklet (Phase 8, owner pick 2026-10-20, replacing
the plain dark launcher look). The public landing is the booklet's cover:
cover green with a deep band, the yellow ink-stroked UDB title, Dee, and a
START button that is the real WebHID request. Below it sit printed spreads
(Controls, Warnings, Compatible devices) on booklet paper with dotted rules
and "p. N" page chips. The app wears the same world in Operate mode: the
band is the top bar and the footer, light is the printed page, dark is the
same booklet at night. The device focus view, setting tiles and read-back
settle are unchanged in behaviour. Source of truth: `src/app.css`. Images:
ADR 10. Brand assets and font: ADR 11.

## Colors

- **Booklet frame** (same in both themes): `cover` #49aa57 (the cover board),
  `band` #0d1a10 (top bar, footer, cover band, page chips), `paper` #f6f2df.
  The band carries its own dark tokens, so it reads the same on light pages.
- **Shell:** light is paper (`bg` #f6f2df < `surface` #fffcef, `raised`
  #e9e2c4, ink text #13200f); dark is night green (`bg` #0d1a10, `surface`
  #142a19, `raised` #1c3a22, paper text #f6f2df). `keyline` is the ink of
  outlines: #13200f on paper, #4e7354 at night.
- **Printed page** (`--page-*`): spreads, terms and contact are always paper
  with ink #13200f, headings #1e4d2b, body #3f4d35, rules #d9d2b4 and dotted
  rules #b7ae8a, whatever the theme.
- **Accent green** (`accent`): selection, focus, links: #1e6b34 on paper,
  #5cc46a at night.
- **Dee yellow** (`yellow` #ffd52e): START and every primary button (ink
  outlined, ink text), seals, the open tile's wash, the current dock pill.
- **Signal orange** (`signal`) means needs attention; **confirmed teal**
  (`confirmed`) means the hardware backed it up; **danger** is failure.

### Named rules
- **Never colour alone.** Every status is an icon, a word and a colour.
- **Brand colours never carry status.** Green and yellow are UDB; teal and
  orange are what the device said.
- **One yellow button per view.** Yellow is START; secondary actions are
  outlined in the keyline.
- **Device LED colours are data.** They appear only as small chips.

## Typography

Fredoka (self-hosted, ADR 11) for headings, the wordmark, buttons, page chips
and Dee's bubbles; the cover title is Fredoka 700 in yellow with a band-colour
stroke and a solid drop, the booklet's printed relief;
the system UI stack (Segoe UI Variable on Windows) for everything else. Values
stay on Segoe UI Variable Display so digits line up. Tracking by size: display
`-0.01em`, values `-0.01em`, body `0`, tags `+0.08em` caps. Monospace only
for hex identifiers and raw values; other numbers use `tabular-nums` (`.num`).

## Layout

A sticky translucent top bar: the app icon and wordmark (a link to Home),
"Identify another device" and "Add device" in a device view, and the theme
switch. Public pages: the landing at `#/` (cover, then spreads p. 2 to p. 7), Terms
(`#/terms`), Contact (`#/contact`, GitHub only), an in-app missing page for
unknown routes and a self-contained `404.html` for GitHub Pages. A visitor
who has opened the app before goes straight to `#/app`. The footer is the
back cover on every page: GitHub, Terms, Contact, the support matrix and the
build's source. App views, kept in the URL hash so Back works:

- **Home** (`#/app`, "Start here", p. 1): a hero of Dee on a lit stage beside
  the logo, the tagline and Dee's bubble (the onboarding, then a greeting),
  with Add device. Then "Your devices" as cards, the way into Supported
  devices, and Settings (Dee's tips, Replay the tour). Under 52rem the hero
  stacks and cards go two across.
- **Device** (`#/device/<key>`), the focus view (Phase 8, comp E): one device
  in focus. The identity column (category and position, the display-size name,
  chips, status, Dee's tip) sits beside the stage, where the device stands
  large with its previous and next neighbours dimmed at the edges as buttons;
  ← and → step between devices (never while a control, the tab list or a
  radio group owns the keys), Close or Esc returns Home. Then a segmented tab
  control (Controls, What UDB knows, Interfaces & diagnostics) and the setting
  tiles. A sticky dock of device pills runs along the bottom edge; the open
  device's pill is yellow. Under 60rem the stage comes first; under 40rem the
  neighbours shrink to ‹ › buttons. Hidden tab panels stay mounted; switching
  devices ends the live session.
- **Supported devices** (`#/supported`): search (name, brand, protocol, USB ID),
  a category switch, and one row per registry entry that opens to its
  features, where each lives, and status.

Focus follows the view: the device title when a device opens, its card when it
closes, the heading otherwise.

## Elevation & depth

Surface steps and hairlines first. Shadows carry an offset and a blur: the
current dock tile, the selected tab, and the product image's drop shadow on
the stage. The top bar is a material: `backdrop-filter: blur(20px)` over
`--chrome`, solid under `prefers-reduced-transparency`.

## Components

- **Stage:** a `figure` with a radial stage light and a floor shadow. It shows
  the product image (ADR 10) or an authored category drawing
  (`DeviceArt.svelte`). Captions say when the image is representative of a
  line, or when the model isn't confirmed.
- **Dock tile:** thumbnail, label, state word with icon. Disconnected devices
  show a grey thumbnail.
- **Notice:** a tile with an icon heading and the recovery ("Close Pulsar
  Fusion, then try again"); amber-tinted when it needs attention.
- **Setting tile (signature):** a tile per setting, one open at a time. Closed,
  it shows the setting and the value the device returned (tag DEVICE, `value`
  type) at full contrast, plus an icon for the last write's result; only its
  chrome dims. Open, it lifts with a yellow edge and shows the read time, the
  control and the outcome. The device's value **settles** into place when it
  changes: blur, lift and opacity on the `--spring` curve (critically damped,
  no overshoot); a short cross-fade under reduced motion.
- **Dee** (`Dee.svelte`, `Guide.svelte`): the mascot beside a speech bubble
  with an ink-and-yellow outline. Recovery notices (busy, disconnected,
  unsupported, a refused or cancelled request) always show Dee, worried (tilted,
  desaturated). Tips beside Controls and diagnostics follow the Guide switch.
  Happy is one small hop when the onboarding completes. The image is
  decorative; everything Dee says is text.
- **Controls** (`src/ui/controls/`): a slider and exact field for ranges (DPI on
  a power curve so 400–3,200 gets most of the track; arrow keys move one real
  step), a segmented row for short lists, swatches plus the system picker for
  colour. They commit on click or release, never while dragging, and then show
  the value the device returned.
- **Buttons:** pills, 40px high, scale 0.97 on press.
- **Icons:** authored SVG on a 20px grid, 1.5px round stroke, `currentColor`.

## Motion

Feedback on press. Two authored moments: the device materialising on the
stage (scale, blur, opacity) and the read-back settle. Around them, quiet
bridges for things that would otherwise teleport, all on `--ease-out` or the
critically damped `--spring`: the theme switch cross-fades the page (view
transition, 240ms); a finished onboarding step's tick lands on the spring; the
request notice drops in from under the top bar (240ms) as worried Dee tilts;
the profile editor and the "Applied" result fade up (200ms); supported-device
rows open to their height (220ms). Home, device switching, tabs and the
segmented controls never animate their navigation: they are used too often.
`prefers-reduced-motion` keeps short opacity fades (120–200ms) and drops every
movement; `prefers-contrast: more` strengthens lines and makes the chrome solid.

## Do's and don'ts

- Do show the last value the device returned as the current state, never the
  requested one.
- Do say where a setting lives: Device, Browser or Companion.
- Do label a product image as representative when it shows the line, not the
  variant.
- Don't use neon, glow, angular "gamer" frames or gradient text.
- Don't let an image or a hero stand in for support status.
- Don't load anything from a vendor at runtime.
