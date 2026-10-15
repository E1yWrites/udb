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
- [x] **Keyboard, Mechlands Vibe75 (`vibe75`).** Protocol recovered with
  Ghidra from `DeviceDriver.exe`, cross-checked against XVX G75 research (same
  OEM family). No USB capture was needed. Results on 2026-10-15:
  - **Lighting brightness** is `write-verified` (5 → 3 → 5 with the vendor's
    write sequence; the keyboard's `04 02` acknowledgement sum matched the
    block; each value was read back).
  - **Persistence:** brightness 3 survived a USB unplug/replug (read back 3
    after re-picking the keyboard; medium confidence, because the write was in
    the previous page load and the keyboard's battery may keep it powered).
  - Found on the way: the Vibe75 has no USB serial, so Chromium's permission
    is lost on unplug. The UI now offers "Pick it again", and SPEC.md records
    the limit.
- [x] **Headset:** a `steelseries-arctis` adapter ported from HeadsetControl,
  tested against bytes derived from its source. Status `experimental`, with no
  UI until a headset exists. **The headset criterion stays open** (ADR 7).
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

**Hardware testing is deferred to Phase 6** (owner decision, 2026-10-15). The
owner has little hardware available, so Phase 4 families land as
`experimental`, tested against fixtures and simulators only. Owned-device
checks happen in the Phase 6 compatibility pass.

### `compx` family (Pulsar, ATK, VXE): branch `phase-4-more-families`
- [x] `docs/protocols/compx.md`: family members, DPI row encodings, sources
  (OpenMouse under AGPL-3.0-or-later, ADR 8)
- [x] DPI encode/decode tests on OpenMouse's ATK X1 Pro Max capture
  (`tests/fixtures/openmouse-atk-x1-pro-max.json`)
- [x] 169 ATK/VXE entries generated from the ATK HUB catalog
  (`npm run import:atk`), all `experimental` or `unsupported`
- [x] Shared receivers resolve to a model by CID/MID; the panel edits DPI
  stages through the write procedure

### QMK/VIA: branch `phase-4-qmk-via` (stacked on the `compx` branch)
- [x] `docs/protocols/qmk-via.md`: commands, version gates, lighting channels,
  brightness scaling, refusals; sources QMK (GPL-2.0-or-later) and the VIA app
  (GPL-3.0, facts only)
- [x] Reply matching and unhandled replies tested against raw VIA replies from
  real keyboards, copied from VIA error logs in public issues
  (`tests/fixtures/via-issue-logs.json`). Lighting is tested against a
  simulator that follows `via.c`.
- [x] One generic registry entry (`qmk/via-keyboard`) with a `byCollection`
  identity: any VID/PID exposing `FF60:0061`, model not confirmed. Lighting
  features are `experimental`; keymap and macros `unsupported`.
- [x] Panel: VIA handshake, layer count, lighting channels found by probing;
  writes save to EEPROM and are read back
- Keymap and macro editing need the board's VIA definition (matrix size,
  layout). They move to Phase 5, loaded from a file the user picks.

### Logitech HID++ 2.0: branch `phase-4-logitech-hidpp` (stacked on QMK/VIA)
- [x] `docs/protocols/logitech-hidpp.md`: transport over split collections,
  device-index probing, the features and functions UDB uses, persistence,
  refusals. Sources: OpenMouse (AGPL-3.0-or-later, code ported per ADR 8),
  libratbag (MIT, device data), Solaar (GPL-2.0-or-later, facts).
- [x] Decoders tested against OpenMouse's recorded hardware observations
  (`tests/fixtures/openmouse-logitech-observations.json`). The session is
  tested against a simulator: receivers with several slots, split interfaces,
  legacy and extended features, refused and ignored writes.
- [x] 62 registry entries (`npm run import:logitech`): 61 models with wired,
  wireless and Bluetooth PIDs, plus `logitech/hidpp-device`, a `byCollection`
  identity limited to VID `046D`. The model behind a receiver resolves from
  the wireless PID the device reports.
- [x] Panel: device, link, HID++ version, battery, onboard mode; DPI and
  report rate through the write procedure. It never switches the onboard
  mode.
- Onboard-profile writes and button remapping move to Phase 5. Both need
  hardware evidence first.

### Razer: branch `phase-4-razer` (stacked on Logitech)
- [x] `docs/protocols/razer.md`: the 90-byte packet, checksum, exchange
  timing, commands, persistence, refusals. Sources: OpenMouse
  (AGPL-3.0-or-later, code and captures), OpenRazer (facts).
- [x] The codec replays **two real hardware captures** byte for byte
  (OpenMouse's DeathAdder V3 Pro sessions, cable and receiver, 243 exchanges
  each): every request re-encodes identically, the allowlist accepts it
  (except the serial read, which UDB refuses), and every reply decodes to the
  recorded values.
- [x] The transport gains a registry-named exception for feature reports a
  collection carries without declaring them (`undeclaredFeatureReports`).
  Razer's control report is undeclared on its mouse collection.
- [x] 82 registry entries (`npm run import:razer`) with per-connection
  `params` (transaction ID, polling command, DPI store and ceiling, battery).
- [x] Panel: firmware, battery; DPI, polling, auto sleep and low-power
  threshold through the write procedure.
- DPI stage tables, lift-off, button mapping and lighting move to Phase 5.

### Wooting: branch `phase-4-wooting` (stacked on Razer), detection only
- [x] `docs/protocols/wooting.md`: sources (RGB SDK, MPL-2.0; OpenMouse,
  facts), why there is no adapter (no public write path with read-back;
  colour writes cannot be read back; the read framing is unsettled), and
  what would unblock it (a device report and a capture of Wootility's WebHID
  traffic)
- [x] 12 registry entries from the SDK's board list, with the analog key
  stream (`FF53`) on the deny list; every feature `unsupported`
- No encode/decode tests: UDB sends Wooting nothing, so there is nothing to
  encode.

### Headsets (HeadsetControl-derived): branch `phase-4-headsets` (stacked on Wooting)
- [x] Logitech HID++ headsets: the Logitech adapter gains `0x1F20` (battery
  voltage) and `0x8300` (sidetone, with read-back). There are 14 headset
  entries generated from HeadsetControl's list, and the panel adds a sidetone
  row. Tests run against a simulated G933 on index `FF`.
- [x] HyperX: 5 headsets, detection only. `docs/protocols/hyperx.md` says
  what HeadsetControl shows and why there is no adapter yet (unknown
  collections; most settings write-only).
- G535 (HID++ on a consumer collection), G930 (not HID++), the PRO X 2
  LIGHTSPEED and G522 (Logitech's "Centurion" protocol) and Astro A50 are left
  for a later pass.

## Phase 5: Profiles, advanced settings, diagnostics, packaging, contributors

- On-device profiles through the adapters; browser profiles with
  import/export.
- QMK/VIA keymap and macro editing from a VIA definition file the user loads.
- Macros, where onboard memory exists.
- A diagnostics page: raw descriptor view and a report log that can be
  exported locally.
- PWA install and offline support.
- `CONTRIBUTING.md` and `TESTING.md` (device-dump workflow, fixture format,
  evidence rules).
- Separate decisions needed: pairing, factory reset, a companion service.

## Phase 6: Security review, compatibility testing, releases

- Review against `THREAT_MODEL.md`.
- A compatibility test pass on every owned device, including the Phase 4
  families' features (deferred there from Phase 4).
- Tagged releases with a changelog; a self-host guide.
