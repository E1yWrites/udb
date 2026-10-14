# UDB roadmap

Each phase is one branch (`phase-<n>-<slug>`) and one PR. A phase passes when
its exit criteria hold and every check passes (tests, typecheck, build, and
`scripts/check-registry.sh`). The owner merges.

Hardware available on the dev machine (Windows 11, ROG Zephyrus G14 GA403):
- Pulsar X2 CrazyLight with 8K dongle (`3710:5406`)
- Mechlands Vibe75 (`05AC:024F`, USB + BLE)
- the G14's built-in keyboard (`0B05:19B6`)
- VXE R1 SE+ (BLE)
- no supported headset

## Phase 0: Bootstrap ✅ (PR #1, merged 2026-10-14)

## Phase 1: Research, architecture, registry schema, design approval (this branch)

Exit criteria:
- [x] `SPEC.md`, `docs/adr/0001`–`0007`, `THREAT_MODEL.md`, `COMPATIBILITY.md`
- [x] Protocol research docs: `compx` (Pulsar), `vibe75`,
  `steelseries-arctis`, `asus-aura` (stub)
- [x] `registry/schema/device.schema.json` plus 4 entries, validated by
  `scripts/check-registry.sh`, including negative fixtures
- [ ] Design direction (`docs/design.md`) approved by the owner
- [ ] Architecture, matrix, threat model, risks and this roadmap approved by
  the owner

## Phase 2: App shell, permission flow, real discovery, registry in the app

Exit criteria:
- Vite + Svelte 5 + TypeScript strict. `npm run check`, `npm test` and
  `npm run build` pass in CI. Deploys to GitHub Pages from `main`.
- `scripts/check-registry.sh` moves into Vitest (ajv as a pinned
  devDependency).
- Transport layer: the **single** caller of `sendReport` and
  `sendFeatureReport`. It enforces adapter allowlists and the registry
  collection denylist. Unit tests prove a non-allowlisted report and a denied
  collection are both rejected before anything reaches WebHID.
- Discovery: `getDevices()` on load, connect/disconnect events, a
  `requestDevice` chooser filtered by the registry, registry matching
  (including Vibe75's Apple-VID case, matched by product name).
- UI states: no WebHID, permission denied, no devices, unsupported device,
  device busy, disconnected. All are visible on real hardware; nothing writes
  yet.
- Support matrix generated from the registry (`SUPPORT.md` or a page). It's
  never edited by hand.
- **Hardware evidence:** the CrazyLight and the Vibe75 appear in the app with
  the correct identity on the dev machine, recorded as `detected` with
  evidence.

## Phase 3: One write-verified device per category you own

Exit criteria:
- `compx` adapter: read-only commands first (`EncryptionData` for CID/MID,
  `DeviceOnLine`, `BatteryLevel`, `ReadFlashData`), then
  `WriteFlashData` on allowlisted addresses only. At least **polling rate**
  and **DPI stage** are `write-verified` on the X2 CrazyLight, with read-back
  and an unplug/replug persistence check recorded as evidence.
- Vibe75: install Ghidra (Linux side) and Wireshark + USBPcap (Windows,
  admin). Recover the protocol from `DeviceDriver.exe` and captures, write
  `docs/protocols/vibe75.md`, and get one setting (e.g. a lighting mode or a
  key remap) `write-verified` with a persistence check.
- `steelseries-arctis` adapter ported from HeadsetControl and tested on
  replayed traffic. Status `experimental`. **The headset criterion stays open**
  (ADR 7).
- Every write follows the SPEC write procedure, and the UI shows the device's
  returned value.

Open item: the headset criterion of the brief's definition of success. It
needs a headset; the recommended buy is the Arctis Nova 7 Gen 2 (`0x227E`).

## Phase 4: Wider support (one PR per protocol family)

Priority, from `COMPATIBILITY.md` (reach × open reference × read-back):
1. QMK/VIA (Keychron and hundreds of QMK boards)
2. Logitech HID++ 2.0 (mice, keyboards)
3. Razer (mice, keyboards; OpenRazer)
4. Wooting (keyboards; 30% pro share)
5. HeadsetControl-derived headsets: HyperX and Logitech
6. LampArray generic lighting (G14 and Windows Dynamic Lighting devices)
7. Then Corsair, ASUS Aura, SteelSeries mice, Glorious, Roccat

Exit criteria for each PR:
- a protocol doc with sources and licenses
- encode/decode tests on captured byte fixtures
- registry entries
- `write-verified` only where owned hardware produced the evidence; everything
  else `experimental`

## Phase 5: Profiles, advanced settings, diagnostics, packaging, contributors

- On-device profiles through the adapters; browser profiles with
  import/export.
- Macros, where onboard memory exists.
- A diagnostics page: raw descriptor view and a report log that can be
  exported locally.
- PWA install and offline support.
- `CONTRIBUTING.md` and `TESTING.md` (device-dump workflow, fixture format,
  evidence rules).
- Separate decisions needed: pairing, factory reset, a companion service.

## Phase 6: Security review, compatibility testing, releases

- Review against `THREAT_MODEL.md`.
- A compatibility test pass on every owned device.
- Tagged releases with a changelog; a self-host guide.
