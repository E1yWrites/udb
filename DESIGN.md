---
name: UDB · Universal Driver Bus
description: One bus. Every device. A control center that shows only what the device reported back.
colors:
  graphite-bg: "oklch(0.205 0.006 70)"
  graphite-rail: "oklch(0.18 0.006 70)"
  graphite-raised: "oklch(0.245 0.007 70)"
  line: "oklch(0.33 0.008 70)"
  line-strong: "oklch(0.45 0.01 70)"
  text: "oklch(0.94 0.008 80)"
  muted: "oklch(0.74 0.01 75)"
  faint: "oklch(0.62 0.01 75)"
  signal: "oklch(0.82 0.14 75)"
  confirmed: "oklch(0.82 0.07 160)"
  danger: "oklch(0.75 0.13 30)"
  light-bg: "oklch(0.972 0.006 85)"
  light-text: "oklch(0.22 0.01 70)"
  light-signal: "oklch(0.56 0.15 60)"
  light-confirmed: "oklch(0.45 0.08 160)"
typography:
  display:
    fontFamily: "'Segoe UI Variable Display', 'Segoe UI', system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  section:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 650
    letterSpacing: "0.06em"
  tag:
    fontFamily: "'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 650
    letterSpacing: "0.08em"
  data:
    fontFamily: "ui-monospace, 'Cascadia Mono', Consolas, monospace"
    fontSize: "0.92em"
rounded:
  control: "6px"
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
    backgroundColor: "{colors.text}"
    textColor: "{colors.graphite-bg}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 16px"
  button:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    height: "36px"
    padding: "0 16px"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.control}"
    height: "36px"
  rail-item-current:
    backgroundColor: "{colors.graphite-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "12px"
---

# Design System: UDB

## Overview

A precision instrument with industrial-minimal restraint, built for a working
screen (Operate mode). The visual system serves one promise: **the device's
word is the only truth on screen.** A calibration certificate supplies the
character: tabular figures, small all-caps tags, and hairline rules instead
of cards. Braun-style minimalism supplies warm neutrals and a single signal
colour. Dark graphite is primary (a desk in a dim room lit by monitors). The
warm off-white light theme follows the OS (`prefers-color-scheme`) and gets
equal care. Source of truth: `src/app.css`.

## Colors

### Primary
- **Text-as-ink** (`text`): primary buttons are solid ink on the ground, not a
  brand hue.

### Secondary
- **Signal amber** (`signal`, `light-signal` in the light theme): means "needs
  your attention" and nothing else. Used for unverified, model not confirmed,
  busy, focus rings and the caret.
- **Confirmed green-grey** (`confirmed`): a value or identity the hardware
  backed up.
- **Danger** (`danger`): only for collections UDB blocks (firmware).

### Neutral
Warm graphite steps (`graphite-bg`, `graphite-rail`, `graphite-raised`) with
hairlines (`line`, `line-strong`). Text tiers are `text`, `muted` and `faint`,
all tinted warm, never pure grey.

### Named Rules
- **One signal.** Amber is never decorative. If nothing needs attention,
  nothing is amber.
- **Never colour alone.** Every status is an icon plus a word plus a colour.
- **Device LED colours are data.** They appear only as small chips, never as
  UI chrome.

## Typography

The system UI stack (Segoe UI Variable on Windows); no web fonts, per the CSP
(ADR 5). Monospace (`data`) only for hex identifiers and raw values.
Everywhere else, numbers use `font-variant-numeric: tabular-nums` (`.num`).

### Hierarchy
- Device name and empty-state title: `display`.
- Section headings ("What UDB knows", "Interfaces"): `section`, all caps.
- Location and role tags (DEVICE, BROWSER, COMPANION, USED BY UDB): `tag`.
- Body copy at most 68–75ch.

## Layout

A top bar, then a two-column workspace: a device rail of 15–18rem with
state words, and a detail pane capped at 60rem. Below 48rem, the rail becomes
a horizontally scrolling strip above the pane and the wordmark's subtitle
hides. The empty state centres a single column of at most 38rem. A footer
holds the privacy line and the support matrix and source links.

## Elevation & Depth

Flat. Depth comes from surface steps (rail < ground < raised) and hairlines,
never from shadows.

## Shapes

A 6px radius on controls and rail items. Tables and notices have no radius;
they are ruled with top and bottom hairlines.

## Components

### Buttons
Primary is ink-filled; the default is outlined in `line-strong`; quiet has no
border and muted text. Each has a 36px minimum height. Hover raises the
background and strengthens the border over 160ms with an expo ease-out.

### Navigation (device rail)
The rail is a `nav` holding a list of buttons, with `aria-current` on the
selected one. Each item shows a state icon, the device label, and a state
word in its tone: Detected (confirmed), Model not confirmed or In use by
another app (signal), Unsupported or Disconnected (muted).

### Notices
A ruled block with an icon, an h2 and an explanation. Each notice names the
problem and the recovery (e.g. "Close Pulsar Fusion, then try again").

### Readings table (signature)
Each row is setting / stored on / status / read-back. Status shows an icon
plus a word. In Phase 3, rows become the **read-back line**: the requested
value on the left, and on the right only the value the device returned, which
settles into place once the device confirms it.

### Icons
Authored SVG on a 20px grid, 1.5px round stroke, `currentColor`
(`src/ui/Icon.svelte`). No emoji and no Unicode glyphs as icons.

## Do's and Don'ts

### Do:
- Show the last value the device returned, never the requested one, as the
  current state.
- Name where a setting lives: Device, Browser or Companion.
- Theme browser surfaces too: selection, caret, focus ring, scrollbar.

### Don't:
- Use gaming chrome: neon, glow, angular frames.
- Dress the app up as an instrument: scope grids, knobs, terminal type
  everywhere.
- Fall back on cards and generic admin dashboards.
- Hide numbers for the sake of minimalism.
- Use vendor logos or product photos.
