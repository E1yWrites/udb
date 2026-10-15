# UDB design direction (shape brief, for approval)

Mode: **Operate.** The visitor comes to get a job done. The world contributes
type, palette, density and one signature move. It never supplies layout,
navigation or controls; those stay standard web components.

## 1. Job and audience

A PC gamer with mixed-brand peripherals, between or before sessions, often
with a game or launcher open. The main visit is a **quick check-and-tweak**:
see what's connected and in what state, change one thing, see the device
confirm it, leave. A deep setup session on one device is the second job.

## 2. Outcome and proof

- Success: a setting changed, **with the device's own read-back shown**, in
  under 30 seconds for a returning user (no permission prompt when the device
  was granted before).
- The proof is the product's truth: the requested value and the
  confirmed-by-device value are visibly different things until they match.
  Nothing is shown as supported without evidence from the registry.

## 3. Selected direction (pinned by the owner)

**Precision instrument × industrial hardware minimalism.** This is translated
so it stays a working product and doesn't turn into a costume: no scope
grids, bezels, knobs or terminal fonts.

- **From the instrument world, its graphic tradition, not its hardware:**
  calibration certificates and spec sheets. "Nominal vs. measured", tolerance
  notes, tabular numbers, small precise labels. This supplies the signature
  move.
- **From industrial minimalism (Braun, Teenage Engineering):** warm neutral
  surfaces, generous but disciplined spacing, big type for structure, a single
  signal colour that means "attention" and nothing else, and controls that
  feel physical through clear states, not texture.

### Signature move: the read-back line

Every device setting renders as a two-part reading:

```
Polling rate      [ 1000 ▾ ]        DEVICE  1000 Hz  ✓ confirmed 14:02:31
DPI stage 2       [ 1600   ]        DEVICE  1600     ✓ confirmed
Lift-off          [ 1 mm ▾ ]        DEVICE  2 mm     ⚠ mismatch: restored to 2 mm
Sidetone          [ 2      ]        SENT    2        ○ device does not report back (experimental)
```

- The left side is what the user asks for. The right side shows only what the
  device returned, set in tabular numbers, with a status glyph *and* a word
  (never colour alone).
- During a write, the right side shows "reading…" and never shows the
  requested value. When the device answers, the number **settles** into place
  (one short, reduced-motion-safe transition). That moment is the brand.
- Each reading carries a location tag: `DEVICE` (stored on the hardware),
  `BROWSER` (stored in this browser), or `COMPANION` (unavailable; explains
  why).

### Palette and type (intent only; exact values come with the build)

- **Physical scene:** a desk in a dim room lit by monitors and RGB, a short
  visit mid-session. So **dark "graphite" is the primary theme**: a warm grey,
  not black, with no neon. A warm off-white light theme follows the OS setting
  and gets equal craft.
- **Colour roles:**
  - neutral surfaces tinted warm
  - **one signal colour** for "needs your attention" (pending, mismatch,
    experimental)
  - a calm "confirmed" tone
  - no rainbow; device LED colours (DPI stage colours) appear only as small
    chips, because those are data
- **Type:** the system UI stack (Segoe UI Variable on Windows) for
  everything, with tabular numbers for readings. No web fonts, so nothing
  third-party is loaded (ADR 5). The scale runs from large model names down
  to small all-caps tags.

## 4. Structure and first viewport

Patterns taken from Pulsar Bibimbap (a working WebHID configurator; patterns
only, none of its branding or assets):
- a connect-first empty state with one primary action
- settings grouped by task in tabs
- DPI stages as a list with each stage's LED-colour chip
- a button map drawn as **leader lines from a device diagram** (UDB uses a
  schematic outline from the registry, never a vendor product photo)
- firmware and battery readouts in the device header

First viewport, desktop:

```
┌ UDB ─────────────────────────────────────────── [+ Add device]  ◐ ┐
│ DEVICES          │ Pulsar X2 CrazyLight             DONGLE · 8 kHz│
│ ● X2 CrazyLight  │ Battery 82% (device) · fw read: v3.05          │
│   confirmed      │ [Performance] [Buttons] [Lighting] [Power] [Info]│
│ ● Vibe75         │ ─────────────────────────────────────────────── │
│   unsupported    │ Polling rate   [1000 ▾]   DEVICE 1000 Hz ✓      │
│ ○ Arctis Nova 7  │ DPI stages     ▮400 ▮800 ▮1600 ▮3200   DEVICE ✓ │
│   not connected  │ Debounce       [2 ms ]    DEVICE 2 ms  ✓        │
│                  │ Motion sync    [ off ]    DEVICE off   ✓        │
└──────────────────┴───────────────────────────────────────────────────┘
```

- **Left rail:** granted devices and their state (connected, asleep, busy,
  unsupported, not connected). This is the check-at-a-glance.
- **Right pane:** the selected device. The header holds identity and
  connection; tabs are generated from capability groups. Only features with
  evidence-backed status render.
- **Narrow screens:** the rail collapses to a device switcher at the top.

## 5. States (all are designed, none are afterthoughts)

| State | What the user sees |
|---|---|
| First run / no WebHID | Why UDB needs Chrome or Edge; no dead controls |
| First run, WebHID OK | One action, "Add device", plus one line on what the permission prompt will ask and why |
| Permission denied / chooser cancelled | What was asked, why, and a retry; never blames the user |
| No devices granted | A connect-first empty state; a link to the support matrix |
| Unsupported device | Its real identity (VID/PID, name) and "unsupported" with the reason; how to help add it (device dump → issue) |
| Device busy | Names the likely app from the registry ("Pulsar Fusion may be running") and how to close it; a retry |
| Asleep / offline (wireless) | Shown as asleep; controls disabled with the reason; refreshes on wake |
| Disconnected mid-write | The reading is marked "failed, device disconnected"; on reconnect UDB re-reads and never assumes |
| Experimental feature | An "unverified" tag; the first write asks for confirmation and explains what that means |
| Mismatch | Requested vs. returned vs. restored, all three visible; a link to report it |
| Needs companion | Listed in a quiet "not available in the browser" group, never as a control |

## 6. Accessibility

WCAG 2.2 AA. Full keyboard operation with a visible focus ring; the rail and
tabs follow the ARIA tabs/listbox patterns. Readings are announced through a
polite live region ("Polling rate confirmed by device: 1000 Hz"). Status is
always glyph + word + colour. Reduced motion disables the settle transition
(the value just swaps). Contrast holds in both themes.

## 7. Boundaries and anti-goals

- Not a gaming-RGB dashboard (angular chrome, glow, neon on black).
- Not an instrument costume (fake scope grids, skeuomorphic knobs, terminal
  fonts throughout).
- Not a generic admin template (sidebar + card grid + charts).
- Not minimalism that hides numbers: readings are always visible.
- No vendor logos or product photos, and no invented testimonials or stats.

## 8. Open decisions for the build (Phase 2)

- The exact signal and confirmed colours, and their contrast in both themes.
- The device-schematic format in the registry (an SVG path plus button
  anchor points).
- Whether the "settle" transition stays under 200 ms or uses an accessible
  count-up.
- The 21st.dev MCP isn't connected in this session; if it gets connected, it
  serves as visual reference only (it ships React, and UDB is Svelte).
