# Protocol family: `lamparray` (HID LampArray, Windows Dynamic Lighting)

Status: **experimental.** No LampArray device has talked to UDB yet. The
owner's ROG Zephyrus G14 exposes one (`0059:0001`), so this family can be
checked on hardware in Phase 6.

## Sources

| Source | What it gave | License | Use |
|---|---|---|---|
| USB HID Usage Tables 1.4, Lighting And Illumination page (`0x59`) | the usages and report semantics | USB-IF specification | facts |
| Microsoft ArduinoHidForWindows `src/LampArrayReportDescriptor.h`, `LampArrayReports.h`, `Microsoft_HidLampArray.cpp` (commit `deb7e5e2`) | a reference descriptor (report IDs 1–6, field order), and which reports a reference device answers on GET | MIT | facts; the test fixture mirrors the descriptor |

## A standard, so no per-model code

LampArray is defined by the HID Usage Tables, not by a vendor. Report IDs and
field layout come from each device's descriptor, which WebHID exposes as
parsed report items (usage, size, count, logical range). UDB builds every
report's layout from those items (`layoutOf`), so one adapter serves any
LampArray device. The registry has one generic entry that matches any device
exposing `0059:0001`, and entries for known devices, like the G14, that win
over it.

## Reports

All are feature reports, each inside a logical collection named by its usage:

| Usage | Report | Direction | UDB |
|---|---|---|---|
| `02` LampArrayAttributesReport | lamp count, bounding box (µm), kind, minimum update interval | GET | read |
| `20` LampAttributesRequestReport | lamp ID to describe next | SET | sent before each lamp read |
| `22` LampAttributesResponseReport | lamp ID, position (µm), update latency, purposes, red/green/blue/intensity level counts, programmable, input binding | GET | read (input binding = the key a lamp sits under, a layout fact, not input) |
| `50` LampMultiUpdateReport | up to *n* lamp IDs with a colour each | SET | **refused** for now |
| `60` LampRangeUpdateReport | flags, first and last lamp ID, one colour | SET | one colour on all lamps |
| `70` LampArrayControlReport | AutonomousMode | SET | off before setting colours; on to hand lighting back |

Microsoft's reference device answers GET only for `02` and `22`. A lamp
request outside the array selects lamp 0, so UDB checks the lamp ID in each
reply. Chromium returns feature replies with the report ID as their first
byte; UDB strips it when present.

## Read-back and persistence

- **Attributes read back**, so they can become `read-verified` on hardware.
- **Colours and autonomous mode cannot be read back.** The spec has no get
  for them, and the reference device doesn't answer GET on those reports. UDB
  reports them as *sent*, never as confirmed (SPEC: "sent; device does not
  report back"). They can never be `write-verified`.
- Host-set colours are volatile: devices start in autonomous mode.

## Conflicts

Windows Dynamic Lighting (Settings → Personalization → Dynamic Lighting) and
vendor apps (Armoury Crate on ROG laptops) drive the same reports and will
overwrite UDB's colours. Turn off "Use Dynamic Lighting on my devices" for the
device, or close the vendor app, before sending colours.

## Refused by the allowlist

Every report the layout doesn't name; GET on the update and control reports;
multi-lamp updates; values above a field's logical maximum; a range that ends
before it starts; anything non-canonical (bits in padding or constant fields).
LampArray has no firmware or reset commands. The G14's firmware-update
collection (`FF82:00CF`) stays on its deny list.

## Open questions (Phase 6, on the G14)

- The G14's report IDs and field layout (its descriptor will tell).
- Does it answer GET on the control report?
- Does Windows Dynamic Lighting hold the device while it is enabled?
