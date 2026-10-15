# Protocol family: `hyperx` (HyperX headsets)

Status: **detection only.** UDB recognises five HyperX headsets by VID/PID and
sends them nothing.

## Sources

| Source | What it gave | License | Use |
|---|---|---|---|
| HeadsetControl `lib/devices/hyperx_*.hpp` (commit `fbbce846`) | product IDs (HP's `03F0` and Kingston's `0951` vendor IDs), commands, which settings exist | GPL-3.0 | facts: the registry entries |

## What HeadsetControl shows

Each headset has its own protocol, so there is no shared adapter:

| Headset | IDs | Commands | Read-back |
|---|---|---|---|
| Cloud II Wireless (HP) | `03F0:0696`, `03F0:018B` | battery, auto-off, on collection `FF90:0303` | battery only |
| Cloud II Wireless (Kingston) | `0951:1718` | report `0x06` frames with a fixed header; battery, sidetone, auto-off | battery only |
| Cloud III | `03F0:089D`, `03F0:03CC` | report `0x20`: sidetone on/off | none |
| Cloud Alpha Wireless | `03F0:098D` | report `0x21`, `BB` prefix: connection, charging and battery reads; sidetone 0–128, auto-off, voice prompts | battery and charging only |
| Cloud Flight Wireless | `0951:16C4`, `0951:1723` | battery | battery |

## Why there is no adapter yet

- **The collections are unknown.** HeadsetControl opens interface 0 by default
  and names a usage page for only one model. A browser needs the collection,
  and UDB's transport only sends report IDs that collection declares.
- **Most settings are write-only.** Sidetone, auto-off and voice prompts never
  read back, so they could never reach `write-verified`. Only battery could
  become `read-verified`.

## What would unblock it

A device report (`Copy device report`) from each headset. It lists the
collections and the report IDs each one declares. Then: battery reads first,
with write-only settings shown as "sent; the headset does not report back"
(SPEC).
