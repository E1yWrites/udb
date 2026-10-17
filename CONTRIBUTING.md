# Contributing to UDB

UDB is a browser-based control center for gaming mice, keyboards and headsets.
Community device support arrives as reviewed pull requests: registry data plus,
where a protocol is known, adapter code. There are no runtime extensions.

Read these first: `SPEC.md` (what UDB does and doesn't), `THREAT_MODEL.md`,
`TESTING.md` (checks, fixtures, evidence) and `docs/adr/`.

## The rules that matter

1. **Truthfulness.** A control is shown only if the device reports its value
   back. Every write is validated, sent, read back and compared; a mismatch is
   restored and shown. A setting the device can't report back is labelled
   "sent; device does not report back" and can never be `write-verified`.
2. **Evidence.** Status is one of `detected`, `read-verified`, `write-verified`,
   `experimental`, `unsupported`, and each carries evidence (source, hardware,
   date, confidence). A simulator or replay is never evidence of hardware
   support. Third-party captures are cited as third-party.
3. **No firmware.** No firmware, bootloader, DFU, pairing or factory-reset
   commands, and no identity writes, in any adapter. Collections that carry them
   go on the registry's `deny` list.
4. **No telemetry, no uploads.** Device dumps reach the project only as issues
   or PRs you file yourself.
5. **Licenses.** UDB is GPL-3.0-or-later (ADR 2). Code may come from GPL-3.0,
   GPL-2.0-or-later and permissive sources, with their notices kept. Sources that
   are GPL-2.0-only or unclear are facts-only references. Code ported from
   OpenMouse (AGPL-3.0) follows ADR 8: a header naming the source file and
   commit. Vendor apps are references only; never copy their code, firmware,
   logos or photos.

## Add a device

### 1. Get a device report

In UDB, add the device (or "Identify another device" if it isn't listed), then
choose "Copy device report" and attach it to a
[new issue](https://github.com/E1yWrites/udb/issues/new). It holds descriptor
details (VID/PID, product name, collections, report sizes) and never input data,
keystrokes or serial numbers. It shows which collections exist and which reports
each declares, which an adapter needs before anything is sent.

### 2. Research the protocol

Start with the community projects (OpenRGB, libratbag, Solaar, OpenRazer,
rivalcfg, HeadsetControl, QMK/VIA, OpenMouse), then check each source's license.
Write `docs/protocols/<family>.md`, following an existing one:

- sources, with license and what each gave (code or facts only);
- report formats, commands, framing and checksums;
- initialization, persistence (does it survive power-off?) and recovery;
- which commands UDB uses, and which it refuses and why;
- what can be read back.

If you can't find a read-back path, say so. Detection-only is a valid result
(see `docs/protocols/wooting.md` and `docs/protocols/hyperx.md`).

### 3. Write the registry entry

`registry/devices/<vendor>/<model>.json`, validated against
`registry/schema/device.schema.json` (the first line points at it). Each entry has:

- `identities`: VID/PID per connection (`wired`, `dongle`, `bluetooth`); a
  wireless device is identified through its receiver, with the model resolved by
  a protocol query where needed;
- `protocol.family`, `protocol.doc` and `protocol.references` (each with
  license and `use: code | facts-only`);
- `collections.use` and `collections.deny`, by usage page and usage;
- `platform`, `conflictingSoftware` (named in the "device busy" message) and
  `limitations`;
- `features`, each with `kind`, `location` (`device`, `browser` or `companion`),
  constraints, `readBack`, `status` and `evidence`.

New features start as `experimental` with `hardware: null`. Moving one to
`read-verified` or `write-verified` needs a hardware test (see `TESTING.md`) and
an evidence entry naming the exact model and firmware.

Generated entries (`npm run import:*`) come from a script that reads a vendored
or embedded table; change the table and rerun it, not the JSON.

After any registry change, run `npm run support`. `SUPPORT.md` is generated;
the test suite fails if it is stale.

### 4. Write the adapter (only with a known protocol)

One adapter per protocol family, not per model:

| File | Owns |
|---|---|
| `src/adapters/<family>.ts` | pure encode and decode, and `allow(report)`: the exact command shapes the protocol doc permits. Everything else is refused. No DOM, no WebHID |
| `src/adapters/<family>-session.ts` | the conversation with one device through `src/lib/transport.ts`, and each setting as a `Setting` for the write procedure (`src/lib/write.ts`) |
| `src/ui/<Family>Panel.svelte` | rendering what the session reads, and the truth states of each control. Registered in `DevicePane.svelte` |

Rules the code enforces:

- Only `src/lib/transport.ts` calls `sendReport`, `sendFeatureReport` or
  `receiveFeatureReport`, and it checks every report against the descriptor, the
  deny list and your `allow()`. `tests/guards.test.ts` fails otherwise.
- Treat every reply as untrusted: check the report ID, length and bounds before
  parsing.
- Adapters never import UI code, so a contributor adding a device never has to
  touch Svelte beyond the panel.
- Write through `applySetting` (read back and compare) or, for settings the
  device can't report, `sendSetting`.

### 5. Test it

Per `TESTING.md`: codec tests against captured fixtures, tests that `allow()`
refuses forbidden commands, a simulator (`tests/<family>-sim.ts`) that follows
the protocol doc, and tests of the session and write procedure against it.
Run `npm run check`, `npm test` and `npm run build`.

## Pull requests

- Fork, branch from an up-to-date `main`, and open a PR against `main`.
- Conventional commit messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`),
  one logical change per commit.
- The PR description lists completed work, devices verified (with the hardware),
  unverified assumptions, blockers and next steps.
- CI must pass (`check`, `test`, `build`). The maintainer reviews and merges;
  `main` changes only through merged PRs.
- Changes to an allowlist, a deny list or the transport need the evidence for
  them in the PR, and update `THREAT_MODEL.md` where the threat table names the
  commands.

## Out of scope for v1

A companion service (features that need one are labelled "needs companion"),
pairing, factory reset, firmware and bootloader commands, runtime extensions,
telemetry and non-Chromium browsers (`SPEC.md`).
