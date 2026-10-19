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

A device launcher (Operate mode) in the manner of Pulsar's BBB and the
Redragon launcher (Phase 7), dressed in the owner's mascot colours (Phase 8):
the grass green of the app icon and Dee's yellow. The connected device stands
lit on a stage; everything around it is what the device itself reported.
Dark is primary (a gamer's desk at night); light (daylight, a pale leaf and
cream shell) gets equal care. A System/Light/Dark switch sets `data-theme` on
`<html>`. Source of truth: `src/app.css`. Images: ADR 10. Brand assets and
font: ADR 11.

## Colors

- **Shell:** green-tinted neutral steps `rail` < `bg` < `surface` < `raised`,
  with `line` and `line-strong` hairlines. Text tiers `text`, `muted`,
  `faint`, tinted toward the hue, never pure grey.
- **Accent, grass green** (`accent`): selection, primary actions, focus ring,
  caret, the wordmark, the stage light.
- **Dee yellow** (`yellow`): the warm highlight. Dee, speech bubbles, the
  current device tile, onboarding. Never text on a light surface; text on
  yellow uses `yellow-ink`.
- **Signal orange** (`signal`): needs your attention (unverified, model not
  confirmed, busy, the write gate). Orange, so it never reads as the brand
  yellow. Never decorative.
- **Confirmed teal** (`confirmed`): the hardware backed it up. Teal, so it
  never reads as the brand green.
- **Danger** (`danger`): failures and collections UDB blocks.

### Named rules
- **Never colour alone.** Every status is an icon, a word and a colour.
- **Brand colours never carry status.** Green and yellow are UDB; teal and
  orange are what the device said.
- **Device LED colours are data.** They appear only as small chips.
- Mix orange and yellow into surfaces in sRGB (`color-mix(in srgb, …)`); an
  oklch mix swings the hue on the light theme.

## Typography

Fredoka (self-hosted, ADR 11) for headings, the wordmark and Dee's bubbles;
the system UI stack (Segoe UI Variable on Windows) for everything else. Values
stay on Segoe UI Variable Display so digits line up. Tracking by size: display
`-0.01em`, values `-0.01em`, body `0`, tags `+0.08em` caps. Monospace only
for hex identifiers and raw values; other numbers use `tabular-nums` (`.num`).

## Layout

A sticky translucent top bar: the app icon and wordmark (a link to Home),
"Identify another device" and "Add device" in a device view, and the theme
switch. Three views, kept in the URL hash so Back works:

- **Home** (`#/`, where UDB always lands): a hero of Dee on a lit stage beside
  the logo, the tagline and Dee's bubble (the onboarding, then a greeting),
  with Add device. Then "Your devices" as cards, the way into Supported
  devices, and Settings (Dee's tips, Replay the tour). Under 52rem the hero
  stacks and cards go two across.
- **Device** (`#/device/<key>`): the device dock of 15–18rem and the device
  pane, capped at 76rem, with Close at the top right (Esc too). A hero of stage
  and identity side by side (stacked under 60rem), then a segmented tab control:
  Controls, What UDB knows, Interfaces & diagnostics. Hidden tab panels stay
  mounted, so a live session survives a tab switch; closing the device or
  switching to another ends it. Under 48rem the dock becomes a horizontal
  snap strip.
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
- **Setting tile (signature):** the setting, then the value the device
  returned (tag DEVICE, `value` type, read time), then the request and Apply,
  then the outcome. The device's value **settles** into place when it
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

Feedback on press. Two authored moments only: the device materialising on the
stage (scale, blur, opacity) and the read-back settle. `prefers-reduced-motion`
swaps both for cross-fades; `prefers-contrast: more` strengthens lines and
makes the chrome solid.

## Do's and don'ts

- Do show the last value the device returned as the current state, never the
  requested one.
- Do say where a setting lives: Device, Browser or Companion.
- Do label a product image as representative when it shows the line, not the
  variant.
- Don't use neon, glow, angular "gamer" frames or gradient text.
- Don't let an image or a hero stand in for support status.
- Don't load anything from a vendor at runtime.
