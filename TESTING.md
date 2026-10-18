# Testing UDB

UDB claims things about hardware, so what counts as evidence is part of the
code's contract. This file says how to run the checks, what the tests cover,
how fixtures and simulators are used, and how a hardware result becomes
evidence in the registry.

## Run the checks

Node 24 or later.

```
npm ci
npm run check    # svelte-check: types and Svelte warnings, warnings fail
npm test         # vitest, tests/**/*.test.ts
npm run build    # production bundle with the CSP meta tag
npm run support  # regenerates SUPPORT.md from the registry
```

CI runs `check`, `test` and `build` on every pull request and push to `main`.
A change is ready when all three pass. `npm run dev` serves the app; add
`?preview` to the URL to load fake devices that answer through the simulators
(development builds only).

## What the suite covers

| Area | Files | What fails the build |
|---|---|---|
| Registry | `tests/registry.test.ts` | an entry that breaks `registry/schema/device.schema.json`; a missing file or protocol doc; a duplicate id; a "bad" example in `registry/schema/invalid/` that the schema now accepts |
| Support matrix | `tests/support.test.ts` | `SUPPORT.md` differs from what the registry generates. Run `npm run support`; never edit it by hand |
| Matching | `tests/match.test.ts` | a VID/PID, product name or protocol identity that resolves to the wrong entry |
| Transport | `tests/transport.test.ts`, `tests/guards.test.ts` | a report that reaches WebHID without passing the declared-report, deny-list and allowlist checks; any module besides `src/lib/transport.ts` calling `sendReport`, `sendFeatureReport` or `receiveFeatureReport`; any `{@html}` in a component |
| Write procedure | `tests/*.test.ts` per family | a write that isn't validated, sent, read back and compared; a mismatch that isn't restored |
| Protocol codecs | `tests/<family>.test.ts` | encode or decode that disagrees with a fixture or with the protocol doc |
| Allowlists | `tests/<family>.test.ts` | a command the protocol doc forbids (firmware, bootloader, reset, identity writes) that an adapter's `allow()` accepts |

## Fixtures

Fixtures are captured bytes in `tests/fixtures/`. They are the only thing a
codec test may treat as ground truth.

- **Name:** `<source>-<device>-<date>.json`, or `.hex` for a large capture.
- **Provenance in the file:** an `about` field with who captured it, the device
  and firmware, the platform and browser, the date, the source commit and its
  license. Third-party captures say so: "Third-party hardware evidence, not UDB
  evidence."
- **Bytes:** space-separated lower-case hex, one report per string. If trailing
  zeros are dropped, `about` says so.
- **Never include** serial numbers, Bluetooth addresses, keystrokes typed during
  the capture, or anything that identifies the person. Strip them before
  committing.
- **Derived bytes** (built from a source's code, with no capture) are allowed
  for codec tests, but the test names them as derived, and they prove only that
  UDB matches the source.

## Simulators

`tests/<family>-sim.ts` is a device that follows the protocol doc: it answers
the commands the doc lists, and ignores or rejects the rest. The tests use it
for sessions and the write procedure, and the dev preview uses it for the UI.

A simulator result is never evidence of hardware support. A simulator's header
says so, and no simulator or replay can produce a `read-verified` or
`write-verified` status.

## Evidence in the registry

Each feature carries `status` and `evidence[]` (`source`, `hardware`, `date`,
`confidence`). The schema enforces:

| Status | Needs |
|---|---|
| `detected`, `experimental`, `unsupported` | evidence with a source; `hardware` may be `null` |
| `read-verified` | evidence with a non-null `hardware` (model and firmware) |
| `write-verified` | the same, and `readBack: true`; a setting the device can't report back can never reach it |
| `location: companion` | status must be `unsupported` |

`registry/schema/invalid/` holds entries that must be rejected (a
`write-verified` with no hardware, with no read-back, a companion feature shown
as supported). If you change the schema, those still have to fail.

## Recording a hardware test

Do this only on a device you own or may lawfully examine.

1. **Device report.** Add the device (or "Identify another device"), then
   "Copy device report". It holds descriptor details only: VID/PID, product
   name, collections and report sizes. It never holds input data, keystrokes or
   serial numbers. Attach it to an issue before any protocol work.
2. **Close the vendor app.** It can hold the interface or overwrite your
   changes.
3. **Read, then change one setting at a time.** The panel shows what the device
   returned, not what you asked for.
4. **Persistence.** Unplug and replug (or power-cycle), and check the setting
   survived. Settings that only live until power-off are labelled so in the
   protocol doc.
5. **Copy the evidence report** from the panel. It holds the byte log, every
   write with its requested, actual and restored values, the reconnect count and,
   for settings that can be read back, your persistence checks.
6. **Update the registry.** In the same pull request, set the feature's status
   (`read-verified` or `write-verified`) with an evidence entry: the source of
   the protocol, `hardware` as the exact model and firmware, the date, and a
   confidence. Attach the evidence report with serials removed.

## Never test

Firmware, bootloader and DFU commands; pairing; factory reset; anything the
registry puts on a collection's `deny` list. They are not implemented, and they
need the owner's separate approval before anyone sends them.

## Hardware pass

The Phase 4 families landed as `experimental` and were tested against fixtures
and simulators only. Checks on owned devices are the Phase 6 compatibility
pass (`ROADMAP.md`).
