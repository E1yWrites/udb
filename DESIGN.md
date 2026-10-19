---
name: UDB · Universal Driver Bus
description: One bus. Every device. A launcher that puts the connected device on a stage and shows only what it reported back.
colors:
  bg: "oklch(0.165 0.018 262)"
  rail: "oklch(0.145 0.018 262)"
  surface: "oklch(0.205 0.022 262)"
  raised: "oklch(0.245 0.024 262)"
  line: "oklch(0.31 0.022 262)"
  line-strong: "oklch(0.44 0.024 262)"
  text: "oklch(0.96 0.006 250)"
  muted: "oklch(0.78 0.018 255)"
  faint: "oklch(0.66 0.02 258)"
  accent: "oklch(0.74 0.14 232)"
  accent-ink: "oklch(0.17 0.04 240)"
  signal: "oklch(0.83 0.14 78)"
  confirmed: "oklch(0.82 0.12 162)"
  danger: "oklch(0.74 0.15 25)"
  stage-light: "oklch(0.6 0.13 236 / 0.34)"
  light-bg: "oklch(0.965 0.006 255)"
  light-surface: "oklch(0.995 0.002 255)"
  light-text: "oklch(0.2 0.02 262)"
  light-accent: "oklch(0.52 0.16 245)"
  light-signal: "oklch(0.55 0.15 60)"
  light-confirmed: "oklch(0.46 0.1 162)"
typography:
  display:
    fontFamily: "'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.6rem + 2.2vw, 3.5rem)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.03em"
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

A device launcher at night (Operate mode), in the manner of Pulsar's BBB and
the Redragon launcher, chosen by the owner in Phase 7. The connected device
stands lit on a stage; everything around it is what the device itself
reported. The scene is a gamer's desk in a dim room, so the deep ink-blue
dark theme is primary; the light theme follows the OS and gets equal care.
Source of truth: `src/app.css`. Images: ADR 10.

## Colors

- **Shell:** ink-blue steps `rail` < `bg` < `surface` < `raised`, with `line`
  and `line-strong` hairlines. Text tiers `text`, `muted`, `faint`, tinted
  blue, never pure grey.
- **Accent** (`accent`): selection, primary actions, focus ring, caret, the
  stage light. Nothing else.
- **Signal amber** (`signal`): needs your attention (unverified, model not
  confirmed, busy, the write gate). Never decorative.
- **Confirmed green** (`confirmed`): the hardware backed it up.
- **Danger** (`danger`): failures and collections UDB blocks.

### Named rules
- **Never colour alone.** Every status is an icon, a word and a colour.
- **Device LED colours are data.** They appear only as small chips.
- Mix amber into surfaces in sRGB (`color-mix(in srgb, …)`); an oklch mix
  swings the hue through blue on the light theme.

## Typography

The system UI stack (Segoe UI Variable on Windows); no web fonts. Tracking by
size: display `-0.03em`, values `-0.01em`, body `0`, tags `+0.08em` caps.
Monospace only for hex identifiers and raw values; other numbers use
`tabular-nums` (`.num`).

## Layout

A sticky translucent top bar (wordmark, "Identify another device", "Add
device"). Below it, a device dock of 15–18rem and the device pane, capped at
76rem: a hero of stage and identity side by side (stacked under 60rem), then a
segmented tab control: Controls, What UDB knows, Interfaces & diagnostics.
Hidden tab panels stay mounted, so a live session survives a tab switch. Under
48rem the dock becomes a horizontal snap strip. The empty state is a lit
stage with the three category drawings above one primary action.

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
