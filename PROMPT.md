PROJECT: Universal Driver Bus (UDB)
TAGLINE: One bus. Every device.

ROLE
You are UDB's lead architect, browser-hardware engineer, reverse-engineering
researcher, and product designer. Build a real peripheral-control platform, not a
mock dashboard.

MISSION
Build a web-based control center that detects supported gaming mice, keyboards and
headsets, and gives one interface for each device's real configurable features,
whatever the brand. The goal is to make fragmented vendor utilities unnecessary for
common tasks.

TOOLS AND WORKFLOW
1. /grill-me (the grilling skill). Interview me about:
   - scope
   - browser vs. desktop architecture
   - target operating systems
   - security
   - device priorities
   - visual identity
   Ask a few questions per batch, highest impact first, and give your recommended
   answer for each. Challenge my assumptions and show me the trade-offs.
2. REA (Reverse Engineer Anything, `rea-agents`). REA works on software: native
   binaries (through Ghidra, IDA or Hopper), Electron/JS apps, .NET assemblies,
   websites, and saved captures. Use it to:
   - audit vendor configuration apps (G HUB, Synapse, iCUE, GG, ...)
   - pull HID command tables and protocol details out of those apps
   - audit existing drivers
   REA does not capture live USB traffic; use Wireshark with USBPcap or usbmon for
   that. Before you use REA, list the commands it actually has and follow its real
   workflow. If REA is not loaded, stop and tell me. Do not invent its functions.
3. /impeccable: design direction, visual hierarchy, interaction quality,
   accessibility, and critique of the design as implemented. Do not default to a
   generic "gaming dashboard" look; settle the direction with me first.
4. After discovery, present for my approval:
   - the architecture
   - the compatibility matrix
   - the threat model
   - the risks
   - the phased roadmap
   - the design direction
   Then build in increments I can verify.

DEVICE COVERAGE
Choose 10 target manufacturers per category. These are targets: they do not mean
every model from those brands is supported. Adjust these candidate lists based on
current market evidence and technical feasibility:
- Mice: Logitech G, Razer, SteelSeries, Corsair, HyperX, ASUS ROG, Glorious,
  Zowie/BenQ, Turtle Beach (incl. Roccat), Pulsar
- Keyboards: Logitech G, Razer, SteelSeries, Corsair, HyperX, ASUS ROG, MSI,
  Wooting, Keychron, Ducky
- Headsets: Logitech G (incl. Astro), Razer, SteelSeries, Corsair, HyperX, ASUS ROG,
  Turtle Beach, Audeze, Sony INZONE, JBL Quantum
Within each brand, start with its best-selling current models. Evaluate the QMK/VIA
protocol early, because a single adapter can cover many keyboards.

DEVICE REGISTRY (single source of truth)
The registry is data. Each entry records:
- vendor/product IDs and model
- connection type (wired / dongle / Bluetooth)
- protocol family
- features
- platform requirements
- known limitations
- protocol references
Each feature has a status: detected | read-verified | write-verified | experimental |
unsupported. Every status carries evidence: the source, the hardware tested, the date,
and a confidence level. Generate the support matrix from the registry; never edit the
matrix by hand.

CORE EXPERIENCE
- Detect compatible devices when they connect, within the limits of browser
  permissions and the platform.
- Show the manufacturer, model, connection and status, and only the controls the
  device really supports.
- Where the protocol allows, support: DPI stages, polling rate, button remapping,
  onboard macros, onboard profiles, RGB, keyboard key configuration, and headset
  settings.
- Label where each setting lives: on the hardware, in this browser, or in the
  companion service.
- Some vendor-app features run on the PC, not the device: software EQ, virtual
  surround, and macros on mice without onboard memory. Mark these "needs companion" or
  out of scope; never show them as device controls.
- Per-device profiles, profile switching, import/export, and persistence where the
  device supports it.
- Safe defaults, explicit permission prompts, recovery after a disconnect, feedback on
  every operation, and troubleshooting for each device.
- Never show a fake control. Never claim a setting was applied without reading it
  back. Never imply support that has not been verified.

TECHNICAL ARCHITECTURE
Evaluate WebHID, WebUSB, Web Bluetooth, OS APIs, and an optional local companion
service. Target Chromium browsers and Windows first, and document the limits on other
platforms. Confirm these known constraints rather than rediscovering them:
- WebHID works only in Chromium browsers, only on a secure context, and
  `requestDevice` needs a user gesture.
- `getDevices()` returns devices granted in earlier visits, so those devices can be
  detected again without a prompt.
- Chromium blocks keyboard, mouse and FIDO top-level collections. Vendor-defined
  usage pages (0xFF00+) are open, and that is where configuration protocols live.
- WebUSB cannot claim HID-class interfaces, and websites cannot install drivers.
- A device behind a wireless dongle must be identified through the receiver, not by
  the dongle's PID.
- Vendor software that is running can hold the interface or fight over it.
- Linux needs udev rules to give access to hidraw devices.

Keep these layers separate: discovery, transport, protocol adapter (one per protocol
family, not one per model), capability model, persistence, profiles, and UI. The UI is
driven by capability data, so protocol details never leak into it. Reuse established
open-source implementations and documented protocols where their licenses allow.

REVERSE ENGINEERING
- Before writing new protocol code, audit the community projects (OpenRGB, libratbag,
  Solaar, OpenRazer, rivalcfg, HeadsetControl, ckb-next, QMK/VIA) and the vendor
  software.
- Check each source's license before reusing code. Some are GPL-2.0-only, which is
  incompatible with GPL-3.0. Choose UDB's license during /grill-me.
- For each protocol family, document: report formats, commands, response parsing,
  initialization, persistence behavior, and recovery.
- Each adapter keeps a command allowlist, and only allowlisted commands are ever sent
  to a device.
- Every write follows the same steps:
  1. Check the value against the capability range.
  2. Send it.
  3. Read it back.
  4. Report the real result. If the read-back doesn't match, restore the previous
     value and tell the user.
- No firmware, bootloader or DFU commands in any phase without my separate approval.
- Test only on hardware that can lawfully be examined. Do not redistribute vendor
  firmware, logos or product photos.

SECURITY AND PRIVACY
- Request only the permission the selected device needs, and explain to the user why.
- Never upload hardware reports, macros, keystrokes or identifying data without the
  user explicitly opting in.
- Treat every device response as untrusted input; check lengths and bounds before
  parsing it.
- v1 default: no runtime extensions. Community device support arrives as reviewed PRs
  (registry data plus adapter code). Design signing, integrity checks and sandboxing
  only if /grill-me puts runtime extensions in scope.

DESIGN PROCESS
Discover the visual identity and interaction model through /grill-me, then refine it
with /impeccable. Cover:
- device discovery and first-run onboarding
- empty states and no devices found
- permission denied
- unsupported device
- device busy (vendor app running)
- connection errors
- profile management
- accessibility
It should feel like a polished hardware utility, not an admin template.

PHASES (each one buildable, testable, committed, and merged through a PR)
0. Bootstrap: repo, workflow rules, auto-commit safety net, REA installed.
1. Research, architecture, registry schema, compatibility matrix, threat model, and
   design approval.
2. App shell, permission flow, real device discovery, and the registry.
3. End-to-end support for at least one write-verified device per category.
4. Wider support through evidence-backed adapters and reproducible hardware tests
   (one PR per protocol family).
5. Profiles, advanced settings, diagnostics, packaging, and the contributor workflow.
6. Security review against the threat model, compatibility testing, and release
   automation.

GIT WORKFLOW
- `main` changes only through merged PRs. Each phase gets its own branch,
  `phase-<n>-<slug>`, cut from an up-to-date `main`.
- Commit after every logical change, using conventional commit messages.
- A Stop hook auto-commits anything left uncommitted on a phase branch. It refuses
  when there are uncommitted changes on `main`.
- Phase gate: the exit criteria are met and the checks pass. Then ask me whether to
  open a PR. If I say yes, push the branch and run `gh pr create`; the PR body is the
  milestone report. I review and merge the PR. If a check fails, do not open a PR.

TESTING
- Unit tests for protocol encode/decode (against captured byte fixtures) and for
  capability mapping.
- Integration tests for the transports, using simulator or replay devices.
- Hardware tests whenever the physical devices are available.
- A simulator result never counts as evidence of real hardware support. Only
  write-verified status counts.

DELIVERABLES
- SPEC.md
- docs/adr/
- the registry, and the support matrix generated from it
- docs/protocols/<family>.md
- THREAT_MODEL.md, TESTING.md, CONTRIBUTING.md, ROADMAP.md

At each milestone, report: completed features, verified devices, unverified
assumptions, blockers, and next steps.

DEFINITION OF SUCCESS
This must hold for at least one device per category:
1. The user connects the device, grants permission, and sees the correct model.
2. They change a setting the device really supports and get truthful read-back
   feedback.
3. They can check whether the setting survives unplugging and replugging.
UDB states its limits honestly, and there is a credible path for adding
community-supported hardware.

FIRST ACTION
Do not write code or UI yet. Confirm which of /grill-me, REA and /impeccable are
actually available and what each can do. Then start /grill-me with the
highest-impact questions, and settle the product and architecture decisions with me
before any implementation.
