# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript (strict), Vite, Svelte 5, Vitest. Static site on GitHub Pages,
deployed from `main` (ADR 3, ADR 6). No runtime third-party scripts (ADR 5).

## Users

A PC gamer who owns peripherals from several brands (mouse, keyboard,
headset). They want to change real device settings (DPI, polling rate,
lighting, sidetone, key mapping) without installing a separate vendor app for
each brand. They usually arrive for a **quick check-and-tweak**: see what's
connected and what state it's in, change one thing, confirm it took, leave.
Deep per-device setup is the less frequent session.

## Product Purpose

One browser-based control center that detects supported devices and exposes
only the settings each device really supports, whatever the brand. Success:
the user connects a device, grants permission, sees the correct model,
changes a supported setting, gets truthful read-back, and can check that the
setting survives unplugging and replugging.

## Positioning

UDB shows only values the device itself reported back, and it says plainly
what is unverified. Vendor apps and generic RGB tools show the requested value
and assume it applied. UDB shows the gap between requested and confirmed, and
labels every setting by where it lives: on the device, in this browser, or
needing a companion app.

## Operating Context

- Windows 11, Chrome or Edge (WebHID needs Chromium and a secure context).
- A WebHID permission prompt per device, triggered by a user gesture;
  previously granted devices reconnect without a prompt.
- Vendor apps that are running can hold the device interface ("device busy").
- Wireless devices sit behind receivers and can be asleep or offline.
- Use happens between or before gaming sessions, often with a game or launcher
  open alongside.

## Capabilities and Constraints

- Feature status vocabulary: `detected`, `read-verified`, `write-verified`,
  `experimental`, `unsupported`, each with evidence (source, hardware, date,
  confidence).
- Every write is validated, sent, read back, and reported. Mismatches are
  restored and shown.
- Features that run on the PC (software EQ, virtual surround, software
  macros) are "needs companion" and are never shown as device controls.
- No firmware, bootloader, DFU, pairing or factory-reset actions in v1.
- No telemetry and no uploads.
- Devices targeted first (owned hardware): Pulsar X2 CrazyLight, Mechlands
  Vibe75. No headset is on hand, so the headset adapter is `experimental` only.

## Brand Commitments

- Name: **UDB, Universal Driver Bus**. Tagline: "One bus. Every device."
- Visual character pinned by the owner (2026-10-19, Phase 7, replacing the
  earlier "precision instrument" look): a device launcher in the manner of
  Pulsar's BBB and the Redragon launcher. The connected device stands lit on a
  stage; requested vs. confirmed-by-device stays the central idea. No neon,
  glow or angular "gamer" chrome.
- Vendor product images are bundled and served from UDB's own origin, with
  provenance (ADR 10). Never vendor logos as UI chrome, and an image never
  stands for support.

## Evidence on Hand

- Protocol research in `docs/protocols/` and the support data in
  `registry/devices/`. No device is verified yet; nothing may be presented as
  supported.
- No testimonials, users, benchmarks or press exist. None may be invented.

## Product Principles

1. Show the device's truth, not the user's request.
2. Never show a control the device can't really honour.
3. Say where each setting lives and how sure UDB is about it.
4. Fast in and out: current state at a glance, one change, confirmed.
5. Make it easy to tell what's unsupported, and how to help support it.

## Accessibility & Inclusion

WCAG 2.2 AA as the floor. Every control is keyboard-operable. Status (e.g.
confirmed, mismatch, unverified) is never conveyed by colour alone. Respect
reduced-motion preferences.
