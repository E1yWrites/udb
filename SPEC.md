# UDB specification (v1)

UDB is a browser-based control center for gaming mice, keyboards and headsets.
It shows only the controls a device really supports, and it reports only
values the device reads back.

Decisions behind this spec are recorded in `docs/adr/`. Protocol facts are in
`docs/protocols/`. Research status is in `COMPATIBILITY.md`.

## Scope

**In v1:**
- Detecting devices that are allowed and previously granted.
- Showing the device's identity and connection.
- Per-feature controls generated from capability data.
- Read-back on every write.
- On-device profiles where the protocol has them; browser-stored profiles with
  import/export otherwise.
- Troubleshooting for each device.

**Not in v1:**
- A companion service. Features that need one are labelled "needs companion".
- Firmware, bootloader and DFU commands, in any phase, without separate
  approval.
- Pairing and factory reset (separate decisions).
- Runtime extensions.
- Telemetry.
- Non-Chromium browsers.

## Platform

Supported and tested: **Windows 11, Chrome and Edge.** Linux (hidraw via udev
rules) and macOS are documented but untested.

Confirmed constraints:
- WebHID needs a secure context, and `requestDevice()` needs a user gesture.
- `getDevices()` returns previously granted devices, so returning users skip
  the prompt.
- Chromium blocks the keyboard usage page, system-control and dock usages
  entirely. On Generic Desktop mouse, pointer, keyboard and keypad
  collections, it blocks input and output reports but **allows feature
  reports** (`IsAlwaysProtected` in
  `services/device/public/cpp/hid/hid_report_utils.cc`). Vendor pages
  (`0xFF00`+), Consumer and LampArray (`0x59`) are open.
- WebUSB cannot claim HID-class interfaces, and websites cannot install
  drivers.
- A wireless device is identified through its receiver. The receiver PID names
  the receiver; the device behind it is identified by a protocol query (for
  example, `compx` CID/MID).
- Vendor software that is running can hold an interface or fight over it.
- Chromium persists a HID permission only for devices with a USB serial
  number and product name (`HidChooserContext::CanStorePersistentEntry`).
  Without a serial (e.g. the Vibe75), the grant is keyed to the connection
  and must be given again after every replug.

## Architecture

```mermaid
flowchart LR
  UI[UI: Svelte, capability-driven] --> CAP[Capability model and write procedure]
  CAP --> AD[Protocol adapter: one per family]
  AD --> TR[Transport: WebHID, allowlist choke point]
  DISC[Discovery: getDevices, connect events, registry match] --> AD
  REG[(Registry: JSON data)] --> DISC
  REG --> CAP
  CAP --> PERS[(Persistence: IndexedDB, browser-side only)]
  PROF[Profiles] --> CAP
```

| Layer | Owns | Never does |
|---|---|---|
| Discovery | Device enumeration, connect/disconnect, matching a HID device to a registry entry, permission prompts | Sending reports |
| Transport | Opening devices, sending and receiving reports, timeouts. **Enforces each adapter's command allowlist and the registry's collection denylist on every outgoing report**, and refuses report IDs the descriptor does not declare unless the registry names them (`undeclaredFeatureReports`, for Razer). | Protocol knowledge |
| Protocol adapter | Encode/decode for one protocol family, framing, checksums, the list of allowed commands | UI concerns; choosing values |
| Capability model | The features a device has, their ranges, where each setting lives, and the **write procedure** | Bytes |
| Persistence | UI preferences and browser-stored profiles | Storing device reports |
| Profiles | On-device profile switching (through the adapter) or browser profile apply/import/export | Bypassing the write procedure |
| UI | Rendering capability data and truth states | Importing adapter or transport code |

Adapter code and registry data have no dependency on the UI, so contributors
adding a device never touch Svelte.

## Capability model

Each feature on a device has:
- `id` (e.g. `dpi.stages`, `polling-rate`, `sidetone`)
- `kind`: `range` | `enum` | `bool` | `color` | `keymap` | `macro` | `profile`
- the constraints (min/max/step or the allowed values)
- `location`: `device` (stored on the hardware), `browser` (stored in this
  browser), or `companion` (needs the PC; shown as unavailable)
- `status`, with evidence (see Registry)

The UI renders only features with `location: device` or `browser` whose status
is `read-verified`, `write-verified` or `experimental`. `experimental`
controls carry an "unverified" label and need an extra confirmation before the
first write.

## Write procedure (one implementation, in the capability layer)

1. Validate the value against the feature's constraints. Reject before
   anything is sent.
2. Send through the adapter. The transport rejects any report not on the
   allowlist.
3. Read back through the adapter.
4. Compare and report. If they match, the value is confirmed. If they don't,
   write the previous value back, read it back again, and show the user
   requested vs. actual vs. restored.

If a feature can't be read back, it can't reach `write-verified`. Its UI says
"sent; device does not report back".

UI truth states for every control: `idle` → `sending` → `confirmed` |
`mismatch-restored` | `mismatch-unrestored` | `failed`. The display always
shows the last value the device returned, never the requested value.

## Registry

JSON files at `registry/devices/<vendor>/<model>.json`, validated against
`registry/schema/device.schema.json`. Each entry records:
- the VID/PIDs and, where needed, the in-protocol identity (e.g. CID/MID).
  A family whose model is only known after a protocol query can instead use
  a `byCollection` identity: it matches any device exposing the entry's
  collection, of any vendor (QMK/VIA) or of one vendor (Logitech HID++
  receivers). An entry with the device's own VID/PID always wins.
- the connection type
- the protocol family
- the collections UDB uses, and **denied collections** (firmware, DFU)
- platform requirements and known limitations
- protocol references
- features, each with a status and evidence

Status: `detected` | `read-verified` | `write-verified` | `experimental` |
`unsupported`.

Evidence on each status: `source`, `hardware` (model and firmware, or null),
`date`, `confidence` (`low` | `medium` | `high`). Only `read-verified` and
`write-verified` require non-null `hardware`. Simulator and replay results can
never produce them.

The support matrix is generated from the registry (Phase 2) and is never
edited by hand.

## Security and privacy

See `THREAT_MODEL.md`. In short:
- request only the device the user picks
- no network calls at runtime other than loading the app itself
- strict CSP
- every device response is untrusted (lengths and bounds checked before
  parsing)
- nothing is uploaded

## Error handling

| Situation | Behaviour |
|---|---|
| WebHID unavailable | Explain which browsers are supported. No dead controls. |
| Permission denied or chooser cancelled | Explain why the permission is needed, and offer to retry. |
| Device not in the registry | Show it as "unsupported": identity only, link to the contribution guide. |
| Interface busy (`open()` fails) | Name the likely vendor app from the registry and say how to close it. |
| Disconnect mid-write | Mark the write `failed`. On reconnect, re-read state; never assume. |
| Device asleep/offline (wireless) | Show it as offline. Allow no writes until the adapter reports it online. |
