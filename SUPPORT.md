# Support matrix

Generated from `registry/devices/` by `npm run support`. **Do not edit by hand.**

Only `read-verified` and `write-verified` mean a result was observed on real hardware.
`experimental` comes from static analysis, documentation or replay. `unsupported` means the
device has the feature but UDB does not control it. `companion` features run on the PC and are
never shown as device controls.

## Mice

### Pulsar X2 CrazyLight (incl. Bruce Lee 85th Anniversary Edition)

Protocol: `compx` ([notes](docs/protocols/compx.md))

| Identity | Connection | Detected by UDB |
|---|---|---|
| `0x3710:0x5406` "Pulsar 8K Dongle" | dongle | Pulsar 8K Dongle bundled with X2 CrazyLight Bruce Lee edition; Microsoft Edge 155 on Windows 11 (ROG Zephyrus G14 GA403), 2026-10-15, high confidence |
| `0x3710:0x3414` "Pulsar X2 CrazyLight" | wired | Pulsar X2 CrazyLight Bruce Lee 85th Anniversary Edition, USB cable; Microsoft Edge 155 on Windows 11 (ROG Zephyrus G14 GA403), 2026-10-15, high confidence |

| Feature | Location | Status | Read-back | Latest evidence |
|---|---|---|---|---|
| polling-rate | device | write-verified | yes | no hardware, 2026-10-15, medium confidence |
| dpi.stages | device | experimental | yes | no hardware, 2026-10-15, low confidence |
| dpi.current-stage | device | read-verified | yes | no hardware, 2026-10-15, medium confidence |
| lift-off-distance | device | experimental | yes | no hardware, 2026-10-15, low confidence |
| debounce-ms | device | write-verified | yes | no hardware, 2026-10-15, medium confidence |
| battery | device | read-verified | yes | no hardware, 2026-10-15, medium confidence |

## Keyboards

### ASUS ROG Zephyrus G14 (GA403) built-in keyboard

Protocol: `asus-aura` ([notes](docs/protocols/asus-aura.md))

| Identity | Connection | Detected by UDB |
|---|---|---|
| `0x0B05:0x19B6` "ITE Device(8910)" | wired | not yet |

| Feature | Location | Status | Read-back | Latest evidence |
|---|---|---|---|---|
| lighting.lamparray | device | unsupported | no | no hardware, 2026-10-15, medium confidence |

### Mechlands Vibe75

Protocol: `vibe75` ([notes](docs/protocols/vibe75.md))

| Identity | Connection | Detected by UDB |
|---|---|---|
| `0x05AC:0x024F` "Mechlands Vibe75" | wired | Mechlands Vibe75, USB cable; Microsoft Edge 155 on Windows 11 (ROG Zephyrus G14 GA403), 2026-10-15, high confidence |
| `0x05AC:0x024F` "2.4G Dongle" | dongle | not yet |
| `0x05AC:0x024F` "Vibe75-1" | bluetooth | not yet |

| Feature | Location | Status | Read-back | Latest evidence |
|---|---|---|---|---|
| lighting.mode | device | experimental | yes | no hardware, 2026-10-15, low confidence |
| lighting.brightness | device | write-verified | yes | no hardware, 2026-10-15, low confidence |
| lighting.speed | device | experimental | yes | no hardware, 2026-10-15, low confidence |
| lighting.per-key | device | unsupported | – | no hardware, 2026-10-15, low confidence |
| keymap | device | unsupported | – | no hardware, 2026-10-15, low confidence |
| screen-image | device | unsupported | – | no hardware, 2026-10-15, low confidence |

## Headsets

### SteelSeries Arctis Nova 7

Protocol: `steelseries-arctis` ([notes](docs/protocols/steelseries-arctis.md))

| Identity | Connection | Detected by UDB |
|---|---|---|
| `0x1038:0x2202` | dongle | not yet |
| `0x1038:0x22A1` | dongle | not yet |
| `0x1038:0x227E` | dongle | not yet |

| Feature | Location | Status | Read-back | Latest evidence |
|---|---|---|---|---|
| sidetone | device | experimental | no | no hardware, 2026-10-15, medium confidence |
| inactive-time-min | device | experimental | no | no hardware, 2026-10-15, medium confidence |
| battery | device | experimental | yes | no hardware, 2026-10-15, medium confidence |
| eq.software | companion | unsupported | – | no hardware, 2026-10-15, high confidence |
