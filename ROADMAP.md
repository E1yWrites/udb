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
- [x] Design direction (`docs/design.md`) approved by the owner (2026-10-15)
- [x] Architecture, matrix, threat model, risks and this roadmap approved by
  the owner (2026-10-15)

## Phase 2: App shell, permission flow, real discovery, registry in the app

Exit criteria:
- [x] Vite + Svelte 5 + TypeScript strict. `npm run check`, `npm test` and
  `npm run build` pass. CI runs them on every PR; a push to `main` deploys to
  GitHub Pages (`.github/workflows/ci.yml`; Pages must be set to the "GitHub
  Actions" source in repo settings).
- [x] Registry schema checks run in Vitest (ajv pinned), including the invalid
  fixtures. `scripts/check-registry.sh` is gone.
- [x] Transport (`src/lib/transport.ts`) is the **single** caller of
  `sendReport`, `sendFeatureReport` and `receiveFeatureReport`; a guard test
  enforces this. Unit tests prove non-allowlisted reports, undeclared report
  IDs and reports on denied collections are rejected before WebHID.
- [x] Discovery: `getDevices()` on load, connect/disconnect events, a
  registry-filtered chooser plus "identify another device", and registry
  matching (the Vibe75's Apple VID by product name).
- [x] UI states built: no WebHID, chooser cancelled, no devices, unsupported,
  model not confirmed, busy, disconnected. On real hardware so far: detected,
  model not confirmed (Pulsar dongle) and unsupported (wired CrazyLight before
  its identity was added). Disconnected, cancelled and busy have been checked
  only with the dev preview fixtures (`/?preview`).
- [x] Support matrix generated from the registry (`SUPPORT.md`, `npm run
  support`); a test fails if it is stale.
- [x] **Hardware evidence (2026-10-15, Edge 155, Windows 11):** Pulsar 8K
  Dongle (`3710:5406`, model not confirmed until the Phase 3 CID/MID query),
  Pulsar X2 CrazyLight on cable (`3710:3414`, model confirmed by its USB
  product string) and Mechlands Vibe75 (`05AC:024F`) are recorded as detected
  in the registry.

## Phase 3: One write-verified device per category you own

Exit criteria:
- [x] **Mouse, Pulsar X2 CrazyLight (`compx`).** Read-only commands first
  (`EncryptionData` → CID 87 / MID 82, `DeviceOnLine`, `BatteryLevel`,
  `ReadFlashData`), then `WriteFlashData` restricted to allowlisted addresses
  and values. Results on 2026-10-15:
  - **Polling rate** is `write-verified` (1000 → 8000 → 1000 → 500 → 1000 Hz,
    each read back) and **kept 500 Hz across a dongle unplug/replug** with the
    mouse power-cycled.
  - **Debounce** is `write-verified` (3 → 2 ms, read back). Persistence not
    yet shown. It replaces "DPI stage" because the owner's mouse has a single
    DPI stage configured; active-stage switching is implemented for
    multi-stage setups and read-verified.
  - Captured bytes are kept as a replay fixture
    (`tests/fixtures/compx-crazylight-2026-10-15.json`).
- [ ] **Keyboard, Mechlands Vibe75 (`vibe75`).** Protocol recovered with
  Ghidra from `DeviceDriver.exe`, cross-checked against XVX G75 research (same
  OEM family). No USB capture was needed. Results on 2026-10-15:
  - **Lighting brightness** is `write-verified` (5 → 3 → 5 with the vendor's
    write sequence; the keyboard's `04 02` acknowledgement sum matched the
    block; each value was read back).
  - **Still open: persistence across unplug/replug.**
- [ ] **Headset:** a `steelseries-arctis` adapter ported from HeadsetControl,
  tested on replayed traffic. Status `experimental`. **The headset criterion
  stays open** (ADR 7).
- [x] Every write follows the SPEC write procedure (`src/lib/write.ts`), and
  the UI shows the value the device returned.

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
