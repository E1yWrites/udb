# Protocol family: `logitech-hidpp` (Logitech HID++ 2.0)

Status: **experimental.** Everything below comes from open-source drivers.
No Logitech device has talked to UDB yet. Tests use a simulator that follows
these notes, plus reply bytes recorded in those drivers' sources.

## Sources

| Source | What it gave | License | Use |
|---|---|---|---|
| OpenMouse mouse-protocol `src/drivers/logitech/hidpp.ts`, `src/logitech/index.ts`, `src/drivers/logitech/bolt.ts`, `docs/logitech-testing.md` (commit `e53af6d5`) | framing, device-index probing, error formats, DPI/report-rate/battery decoding, receiver and direct PIDs, hardware notes from G402, G502 X, PRO X 2 Superstrike and Bolt users | AGPL-3.0-or-later | code (ADR 8): decoders and lists ported into `src/adapters/logitech-hidpp.ts` |
| libratbag `data/devices/logitech-*.device` (commit `8235b5bb`) | model names and USB, wireless and Bluetooth PIDs | MIT | data: `npm run import:logitech` generates the registry entries |
| HeadsetControl `lib/devices/logitech_*.hpp`, `protocols/hidpp_protocol.hpp` (commit `fbbce846`) | HID++ headset product IDs and the battery-voltage reply layout | GPL-3.0 | data: headset registry entries (`third_party/headsetcontrol`) |
| Solaar `lib/logitech_receiver/settings_templates.py` (commit `e7304c4c`) | function numbers for 0x2201, 0x2202, 0x8060 and 0x8061 (they agree with OpenMouse); a DPI reading of 0 means "use the default" | GPL-2.0-or-later | facts |

## Transport

HID++ runs on Logitech vendor collections:

| Collection | Report | Size (after the ID) | Where |
|---|---|---|---|
| `FF00:0001` | `0x10` short | 6 bytes | receivers and wired mice |
| `FF00:0002` | `0x11` long | 19 bytes | receivers and wired mice; the only one Bolt devices answer on |
| `FF43:0202` | `0x11` long | 19 bytes | Bluetooth, and some newer USB mice |

On Windows each top-level collection is its own `HIDDevice`. A short request
can be answered with a long report on the *other* collection. So UDB sends on
one interface and listens for both report IDs on every granted HID++
interface of the device. It sends **long** requests whenever a long
collection is granted. HID++ 2.0 devices accept long requests for every
function, and Bolt and Bluetooth only take long ones. Short is the fallback,
for at most three parameters.

Message: `[device index, feature index, function << 4 | software ID, params…]`.
UDB's software ID is `0x0A`; ID 0 is reserved for notifications from the
device.

Byte numbers below count from the device index (byte 0), not the report ID,
so a reply's first parameter is byte 3.

Errors:
- HID++ 2.0: `[device, FF, feature index, function|sw, code]`
- HID++ 1.0: `[device, 8F, sub-ID, address, code]`. Receivers send this for
  an empty pairing slot.

A reply belongs to a request when the device index, feature index and
function|sw byte echo it, or when it is an error naming them.

## Device index

A receiver forwards to pairing slots `01`–`06`; a mouse on its own cable
answers as `FF`. Descriptors can't tell which, so UDB asks: root
`getFeature(0x0003)` on each candidate (receivers: `01`…`06`, then `FF`;
everything else: `FF`, then `01`). Only a HID++ 2.0 answer (a reply or an `FF`
error) counts. A HID++ 1.0 error or a timeout means nobody is there. This is
OpenMouse's order. Their notes add that G HUB can move a mouse off slot 1, and
that a PRO X Superlight's `FF` answers without a sensor (so UDB keeps probing
past an index with no DPI feature when the device is a mouse).

## Features UDB uses

The feature *index* differs per device. UDB looks each one up through the
root feature, and the allowlist only accepts a feature index the device itself
reported for that feature ID.

| Feature | Functions UDB sends | Reply |
|---|---|---|
| `0x0000` Root | 0 `getFeature(idHi, idLo)`, 1 `getProtocolVersion` | `[index, type, version]`; `[major, minor, ping]` |
| `0x0003` DeviceInformation | 0 `getDeviceInfo` | transport flags at byte 9 (BT, BLE, wireless, USB), up to three 2-byte PIDs at 10–15 |
| `0x0005` DeviceName | 0 `getCount`, 1 `getName(offset)` | name length; up to 16 characters per reply |
| `0x1000` BatteryLevelStatus | 0 | `[percent, next, status]` |
| `0x1001` BatteryVoltage | 0 | `[mV hi, mV lo, flags]` |
| `0x1004` UnifiedBattery | 1 `getStatus` | `[percent, level, charging, external]` (its own charging codes, unlike 0x1000) |
| `0x2201` AdjustableDPI | 1 `getSensorDpiList(0)`, 2 `getSensorDpi(0)`, 3 `setSensorDpi(0, hi, lo)` | list of uint16, where `0xE000 \| step` marks a range; `[sensor, dpi, default]` (dpi 0 → default) |
| `0x2202` ExtendedAdjustableDPI | 1 `getSensorCapabilities(0)`, 2 `getSensorDpiRanges(0, 0, page)`, 5 `getSensorDpiParameters(0)`, 6 `setSensorDpiParameters(0, x, y, lod)` | ranges as above, from byte 6; `[sensor, x, defX, y, defY, lod]` |
| `0x8060` ReportRate | 0 `getReportRateList`, 1 `getReportRate`, 2 `setReportRate(ms)` | bitmap, bit i = (i+1) ms; current ms |
| `0x8061` ExtendedReportRate | 1 `getReportRateList(conn)`, 2 `getReportRate(conn)`, 3 `setReportRate(code)` | 16-bit mask; code 0–6 = 125…8000 Hz; `conn` 0 = cable, 1 = wireless |
| `0x8100` OnboardProfiles | 2 `getOnboardMode` | 1 = onboard, 2 = host |
| `0x1F20` ADCMeasurement | 0 | `[mV, flags]` (headsets, see below) |
| `0x8300` Sidetone | 0 `get`, 1 `set(0–100)` | `[level]` (headsets) |

Model identity behind a receiver: `0x0003`'s wireless PID (the transport with
flag `0x04`). That is the PID libratbag lists (`usb:046d:40xx`), so UDB looks it
up in the registry like a USB ID. On Linux, the kernel's `hid-logitech-dj`
driver exposes the same PID as a device of its own.

## Headsets

HeadsetControl drives Logitech's HID++ headsets (G633/G635/G733/G933/G935,
G431–G433, G533, G PRO/PRO X/PRO X 2, Zone Wired/750) by hard-coded feature
*indices* (for example `0x08`/`0x0A` for battery on the G933). UDB looks the
features up by ID instead:

| Feature | Functions | Reply | Source |
|---|---|---|---|
| `0x1F20` ADC measurement | 0 | `[mV hi, mV lo, flags]`, bit 0 = valid, bit 1 = charging | g933-utils; HeadsetControl's G933 battery command reads the same layout |
| `0x8300` Sidetone | 0 get, 1 set(0–100) | `[level]` | Solaar |

Sidetone has a getter, so it goes through the full write procedure. Battery
percentages are estimated from voltage. HeadsetControl keeps calibration tables
per model; UDB uses one Li-ion curve and shows the millivolts too. If a headset
implements these under other feature IDs, the panel simply shows no control for
them. A headset on its own dongle answers on index `FF`.

## Writes and persistence

UDB changes DPI and report rate with the live functions above, then reads them
back with the matching get. It **never switches the onboard mode**.
`setOnboardMode` is a lasting change that bypasses the user's onboard profile
after the tab closes (OpenMouse avoids it on wired mice for the same reason).
Consequences:

- In **host mode**, live values are not stored on the mouse. They are lost at
  power-off (G HUB reapplies them).
- In **onboard mode**, some mice accept a live DPI write until the next stage
  or profile change. Others reject live writes (OpenMouse saw HID++ error
  `0x02` for report rate on Superlight-era mice). The write procedure reports
  what the mouse did.

The panel shows the onboard mode, so the user knows which case applies.
Writing onboard profiles (flash sectors with CRCs) is Phase 5 work and needs
hardware evidence first.

## Refused by the allowlist

- every HID++ 1.0 register command (sub-IDs `80`–`83`, `B5`, pairing)
- every feature not in the table above, in particular DFU (`0x00C2`,
  `0x00C3`, `0x00D0`), device reset (`0x1802`), OOB state (`0x1805`), change
  host (`0x1814`), hidden features (`0x1E00`, `0x1DF3`), button remapping
  (`0x1B04`) and lighting (`0x8070`, `0x8071`, `0x8081`)
- `0x8100` anything but `getOnboardMode`: mode switches, profile and memory
  writes
- device indices other than `01`–`06` and `FF`; any software ID but UDB's
- values out of shape: sensor other than 0, a DPI that is a range marker,
  report-rate codes above 6, milliseconds outside 1–8, a 0x8061 connection
  other than 0 or 1, a lift-off byte above 3

## Open questions (Phase 6, needs a Logitech mouse)

- Do Lightspeed mice in onboard mode accept live DPI writes, and do those
  survive a stage button press?
- Does 0x8061 `getReportRate(conn)` report the configured or the live rate
  after a write? OpenMouse waits for the rate-change notification instead.
