# 1. Browser-only app on WebHID

Status: accepted, 2026-10-15

## Context
The brief asks for a web control center. The options were browser-only,
browser plus a local companion service, or a desktop app (Tauri or Electron).
A companion is a signed, auto-updating daemon that every browser tab could
talk to, so it would be the largest attack surface in the system.

## Decision
v1 is a static web app (PWA) using WebHID only. Features that run on the PC
are labelled "needs companion" and are never shown as device controls. The
companion is a separate decision, revisited after Phase 3.

## Consequences
- Chromium only. No background features (switching profiles when a game
  launches, software macros, software EQ).
- Keyboard/mouse input and output reports are blocked. Feature reports on
  those collections, and every vendor page, are reachable.
