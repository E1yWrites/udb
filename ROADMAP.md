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

### HID LampArray: branch `phase-4-lamparray` (stacked on headsets)
- [x] `docs/protocols/lamparray.md`: the standard (HUT 1.4, page `0x59`),
  Microsoft's reference device (MIT), read-back limits, conflicts with Windows
  Dynamic Lighting
- [x] A descriptor-driven adapter: report IDs and field layout come from the
  device's own report items, with bit-exact encode and decode tested on
  Microsoft's reference descriptor
- [x] The write procedure gains `sendSetting` for settings without
  read-back. Colours are reported as *sent*, never confirmed (SPEC).
- [x] A generic `lamparray/device` entry (any device exposing `0059:0001`).
  The G14 entry moves to this family; Aura stays a later item.
- [x] Panel: lamp count, kind, size, per-lamp summary; one colour on all lamps;
  hand lighting back to the device
- **Phase 6 on the G14:** read the attributes (they can become
  `read-verified`) and record its descriptor.

### Long tail: Corsair, branch `phase-4-corsair` (stacked on LampArray)
- [x] `docs/protocols/corsair.md`: the classic (NXP) protocol as OpenMouse
  verified it on a NIGHTSWORD RGB (feature-report transport, no reply to SET,
  DPI big-endian on GET and little-endian on SET, live-only settings), and
  Bragi's status
- [x] Adapter ported from OpenMouse. Tests use its NIGHTSWORD replies and
  write probe (`tests/fixtures/openmouse-corsair-nightsword-2026-09.json`).
- [x] Entries: NIGHTSWORD RGB (experimental); IRONCLAW RGB WIRELESS and its
  receivers (Bragi, detection only)
- [x] Panel: firmware, polling (read), enabled stages; active stage, stage
  DPI (colour kept), lift-off and angle snapping, with a note that they are
  live settings

### Long tail: ASUS Aura, branch `phase-4-aura` (stacked on Corsair), detection only
- [x] `docs/protocols/asus-aura.md`: Aura is about ten sub-protocols, all
  lighting with no read-back; sources OpenRGB (GPL-2.0-or-later) and asusctl
  (MPL-2.0), facts only; why there is no adapter and what would unblock one
- [x] 55 keyboard and mouse entries (73 product IDs) generated from OpenRGB's
  tables (`npm run import:aura`); no adapter, UDB sends them nothing
- [ ] Waiting on a device report from an Aura keyboard or mouse, and a decision
  on a send-only lighting path (see the doc)

### Long tail: SteelSeries mice, branch `phase-4-steelseries` (stacked on Aura), detection only
- [x] `docs/protocols/steelseries-mouse.md`: 24 codec families, no settings
  getter, what OpenMouse observed on an Aerox 3 Wireless, why there is no
  adapter and what would unblock one
- [x] 56 mouse entries (69 product IDs) generated from OpenMouse's table
  (`npm run import:steelseries`); no adapter, UDB sends them nothing
- [ ] Waiting on device reports per family, and a decision on how to show a
  write the mouse acknowledges but cannot report

### Long tail: Glorious, branch `phase-4-glorious` (stacked on SteelSeries), detection only
- [x] `docs/protocols/glorious.md`: the Pixart, classic and 4K/8K generations,
  the O 2 PRO 4K/8K frame layout from OpenMouse's capture notes, uncertain PIDs,
  why there is no adapter and what would unblock one
- [x] 23 mouse entries (42 product IDs) from OpenMouse's tables
  (`npm run import:glorious`); no adapter, UDB sends them nothing
- [ ] Waiting on a device report from a Glorious mouse, and a way to show which
  profile a write lands in

### Long tail: ROCCAT, branch `phase-4-roccat` (stacked on Glorious), detection only
- [x] `docs/protocols/roccat.md`: the Kone XTD, Pure and EMP report scheme from
  libratbag (MIT), read-back and checksum, why there is no adapter yet
- [x] 3 mouse entries (5 product IDs); no adapter, UDB sends them nothing
- [ ] An adapter for DPI stages and polling rate on the Kone XTD, once a device
  report shows the collection (the only long-tail family with a read-back path)

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
  **Decided 2026-10-18: all three stay out of v1.** Pairing and factory reset can
  unpair or brick a device (THREAT_MODEL T5), and a companion service breaks the
  browser-only, no-backend design. Each needs its own owner approval to reopen.

Phase 5 lands as stacked branches, one per item:

### Contributor docs: branch `phase-5-contributors`
- [x] `CONTRIBUTING.md`: the rules, the device workflow (device report,
  protocol doc, registry entry, adapter, tests), PR conventions
- [x] `TESTING.md`: the checks, what the suite covers, fixture format,
  simulators, the evidence rules, how a hardware test becomes registry evidence
- [x] `README.md` points at both

### Diagnostics: branch `phase-5-diagnostics` (stacked on contributor docs)
- [x] A Diagnostics section on every device pane: the report descriptor as the
  browser parsed it (collections, reports, items), and the report log, with
  "Copy diagnostics" and "Save as file". Exports stay local and carry a warning
  that replies can hold identifiers.
- [x] One byte log per device, shared by every panel and the diagnostics view
  (`src/lib/history.svelte.ts`), so the log updates live
- [x] Tests: the descriptor formatter and the export's contents

### PWA: branch `phase-5-pwa` (stacked on diagnostics)
- [x] Web manifest, an icon (`public/icon.svg` and 192/512 PNGs), and an
  installable site; Chromium reports no installability errors
- [x] A service worker generated at build time (`scripts/service-worker.ts`,
  ADR 9): precaches the build, network-first navigation, no early takeover
- [x] Checked in Chromium against the production build: the worker activates,
  the build is precached, and a reload with the network off still opens the app
- [x] `tests/service-worker.test.ts` runs the generated worker against a fake scope

### Profiles: branch `phase-5-profiles` (stacked on the PWA)
- [x] Browser profiles on the five panels with per-setting read-back
  (`compx`, `corsair-nxp`, `logitech-hidpp`, `razer`, `qmk-via`): save what the
  device returned, apply through the write procedure, export and import as JSON
  (`src/lib/profiles.ts`, `src/ui/ProfileBar.svelte`)
- [x] Imported files are untrusted: size, shape and every key and value checked
  (`tests/profiles.test.ts`, THREAT_MODEL T13)
- [x] Checked in Chromium against the preview Corsair: save, change, apply
  restores the saved value with device confirmation, a bad import is rejected
- [ ] On-device profile switching: no current adapter has a read-back selector
  (see `SPEC.md`); the ROCCAT Kone is the first candidate
- [ ] LampArray and Vibe75 have no profiles: their settings are not read back one by one

### VIA keymap: branch `phase-5-via-keymap` (stacked on profiles)
- [x] `04`/`05` on the allowlist only after a definition is loaded, bounded by
  the layer count and the definition's matrix; basic keys only, or a value the
  keyboard returned for that key (`docs/protocols/qmk-via.md`, T14)
- [x] A parser for the VIA definition file (untrusted input) and the QMK basic
  keycode names (`src/adapters/via-definition.ts`, `via-keycodes.ts`)
- [x] `src/ui/ViaKeymap.svelte`: the layout drawn from the file, layer tabs,
  user-chosen layout options, per-key read, write with read-back, restore
- [x] Checked in Chromium against the preview Keychron: load, read, change,
  restore, layer and option switch; no page overflow at 390px
- [ ] Macros are not built: the VIA macro commands (`0C` to `10`) stay refused.
  Onboard macros on other families need a protocol with a read-back first
- [ ] The `keymap` feature stays `experimental` until a VIA keyboard confirms it (Phase 6)

## Phase 6: Security review, compatibility testing, releases

- Review against `THREAT_MODEL.md`.
- A compatibility test pass on every owned device, including the Phase 4
  families' features (deferred there from Phase 4).
- Tagged releases with a changelog; a self-host guide.

## Phase 7: Launcher redesign, branch `phase-7-ui-redesign`

Owner decision, 2026-10-19: a launcher look (references: Pulsar's BBB, the
Redragon launcher) with product images of the supported models.
- [x] ADR 10: vendor images bundled with provenance, never loaded from vendors
  at runtime; `npm run import:images`; 191 cutouts cover 363 of 489 entries
- [x] Device stage (image or category drawing, "representative" and "model not
  confirmed" captions), device dock with thumbnails, tabs, read-back tiles
- [x] Service worker skips `devices/` on install; `tests/images.test.ts` checks
  files, digests and mappings
- [x] Image sources for Logitech, ROG, HyperX, Wooting and Corsair
- [ ] Remaining gaps: most SteelSeries mice, older Logitech, ASUS TUF and older
  ROG, ROCCAT, older Wooting (ADR 10)

## Phase 8: Brand, Home, controls, profiles

Owner decisions, 2026-10-19: green and yellow throughout (the app icon's grass
green leads), a light/dark switch, the mascot Dee as a guide everywhere with
an onboarding, a Home menu when no device is open, richer DPI, polling and
colour controls that write on release, and category profiles (Mouse,
Keyboard) you can edit. Four stacked branches.

### Brand: branch `phase-8-brand`
- [x] Tokens: grass green accent, Dee yellow highlight, orange for attention,
  teal for confirmed; AA contrast checked in both themes (`src/app.css`)
- [x] System/Light/Dark switch, kept in this browser (`src/lib/prefs.svelte.ts`,
  `src/ui/ThemeSwitch.svelte`)
- [x] Dee, logo and app icons from the owner's art; Fredoka self-hosted (ADR 11)


### Home and Dee: branch `phase-8-home` (stacked on brand)
- [x] Home is where UDB lands (`src/ui/Home.svelte`); a device opens from its
  card and closes with Close, Esc or Back, with focus returned to its card
- [x] Onboarding in Dee's bubble: three steps that tick off as you do them
  (browser, add a device, the first value a device returns); skip and replay
- [x] Dee on recovery notices and tips beside Controls and diagnostics; a Guide
  switch for the tips (`src/ui/Dee.svelte`, `src/ui/Guide.svelte`)
- [x] Supported devices: every registry entry, searchable by name, brand,
  protocol or USB ID, with per-feature status (`src/ui/SupportedList.svelte`)

### Controls: branch `phase-8-controls` (stacked on Home)
- [x] Shared controls (`src/ui/controls/`): a DPI slider on a power curve with
  an exact field, segmented choices for polling rate, active stage and other
  short lists, colour swatches and the system picker, hue and saturation tracks
- [x] Each click, release or arrow key writes once through the panel's write
  procedure and reads back; one write at a time per device, newest value wins
  (`src/lib/commit.ts`, `tests/commit.test.ts`)
- [x] compx, Razer, Logitech HID++, Corsair and VIA panels; long lists (debounce,
  sleep, VIA effect numbers) keep a select or field with Apply
- [x] No colour control on any mouse: no mouse adapter writes lighting yet

### Profiles: branch `phase-8-profiles` (stacked on controls)
- [x] v2 profiles: Mouse (DPI stages, active stage, polling rate, colour) and
  Keyboard (colour, brightness, effect within its family), applied to any
  device of the category (`src/lib/profiles.ts`, `src/lib/profile-map.ts`)
- [x] Applying says what the device couldn't take; every value is written
  through the panel's write procedure and read back
- [x] The library on Home: make, edit, import and export without a device
  (`src/ui/ProfileLibrary.svelte`, `src/ui/ProfileEditor.svelte`)
- [x] v1 profiles converted once; unconvertible ones kept and exportable
  (`tests/profiles.test.ts`, THREAT_MODEL T13)
- [ ] Mouse colour: no mouse adapter writes lighting, so it's stored and
  skipped. Needs a protocol with a lighting read-back first
- [ ] Headset profiles (sidetone) are not covered; v1 ones are kept

### Motion and focus view: branches `phase-8-motion`, `phase-8-focus` (stacked on profiles)
- [x] The animation survey's six quiet entrances and the theme cross-fade
- [x] Redesign comps (two rolls, six structures); owner picked E, the focus view
- [x] One device in focus with dimmed neighbours, ←/→ between devices, setting
  tiles that open one at a time, a bottom dock of device pills

### Booklet overhaul: branch `phase-8-booklet` (stacked on focus)
- [x] Landing comps (direction roll, three cards); owner picked the instruction booklet
- [x] Landing at `#/` with START as the real device request; the app moves to `#/app`
- [x] Terms, Contact (GitHub issues only), an in-app missing page and a
  self-contained `404.html` for GitHub Pages; a back-cover footer on every page
- [x] Booklet tokens across the app in both themes (DESIGN.md)
- [ ] Owner review of the Terms text before deploying; turn on private
  vulnerability reporting on GitHub so the Contact page's security link works
