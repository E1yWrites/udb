# Protocol family: `qmk-via` (QMK firmware with VIA enabled)

Status: **experimental.** Everything below comes from QMK's source and the VIA
app's source. No VIA keyboard has talked to UDB yet. Tests use bytes derived
from `quantum/via.c`, not captures.

## Sources

| Source | What it gave | License | Use |
|---|---|---|---|
| QMK `quantum/via.h`, `quantum/via.c` (commit `7a1bbf37`, 2026-10-15) | command IDs, channel and value IDs, reply format, lighting scaling | GPL-2.0-or-later | code: the ID enums are transcribed |
| QMK `tmk_core/protocol/usb_descriptor.c` | raw HID collection `FF60:0061`, 32-byte reports, no report ID | GPL-2.0-or-later | facts |
| VIA app `src/utils/keyboard-api.ts`, `src/shims/node-hid.ts` (commit `935106a9`) | WebHID framing (`sendReport(0, 32 bytes)`), reply check (the reply must echo the command and its arguments) | GPL-3.0 | facts |

## Identification

VIA works on any QMK keyboard built with `VIA_ENABLE`. It is not tied to a
vendor, so the registry has **one generic entry** (`qmk/via-keyboard`) whose
identity matches any device exposing the raw HID collection `FF60:0061`.
A registry entry with the board's own VID/PID wins over the generic one.

The collection alone doesn't prove VIA. QMK boards with `RAW_ENABLE` but no
VIA use the same collection with their own handler. UDB therefore sends nothing
until the user asks, and then only `01` (get protocol version). It continues
only when the reply echoes `01` and the version is one UDB knows.

| Protocol version | Firmware | UDB |
|---|---|---|
| `0x0009`–`0x000B` | VIA v2 era; Vial reports 9 (checked in `vial-qmk`) | handshake and layer count. Commands `07`–`09` mean "lighting" with a different value-ID layout, so UDB sends none of them. |
| `0x000C` (12) | QMK 0.19+, VIA v3 definitions | handshake, layer count, lighting channels |
| `0x000D` (13) | QMK master, 2026-10-15 | as 12 |
| anything else | unknown | handshake only |

The model name shown is the USB product string. VIA itself identifies a board
by VID/PID plus a separate keyboard definition (matrix size, layout, lighting
menus). UDB loads no definitions in this phase.

## Framing

- Output report, report ID 0, **32 bytes**. Byte 0 is the command ID.
- The keyboard answers with an input report on the same collection: the same
  32-byte buffer, with values filled in.
- If the command or value ID is unknown, byte 0 comes back as `FF`
  (`id_unhandled`) and the rest is echoed unchanged.
- A reply belongs to a request when byte 0 is the command (or `FF`) and the
  argument bytes are echoed. The VIA app checks the same echo. A keyboard can
  also push unsolicited reports on this collection (VIA's UI-sync requests), so
  the echo check matters.

## Commands UDB sends

| Bytes | Meaning | Reply |
|---|---|---|
| `01` | get protocol version | `01 hi lo` |
| `11` | get dynamic keymap layer count (versions 9–13 only) | `11 n` |
| `04 layer row col` | get a keycode (after a definition is loaded) | `04 layer row col hi lo` |
| `05 layer row col hi lo` | set a keycode (same condition) | echo |
| `08 ch id` | get a custom value (version 12–13 only) | `08 ch id v0 [v1]` |
| `07 ch id v0 [v1]` | set a custom value, in RAM only (`_noeeprom`) | echo |
| `09 ch` | save the channel to EEPROM | echo |

Channels and value IDs (`via.h`):

| Channel | `01` | `02` | `03` | `04` |
|---|---|---|---|---|
| `1` backlight | brightness | effect (breathing 0/1) | – | – |
| `2` rgblight | brightness | effect | effect speed | colour (hue, sat) |
| `3` RGB matrix | brightness | effect | effect speed | colour (hue, sat) |
| `5` LED matrix | brightness | effect | effect speed | – |

A channel the firmware wasn't built with replies `FF`. UDB reads brightness on
each channel and shows only the channels that answer. An unknown *value* ID on
a built channel is **not** flagged: the firmware leaves the buffer as sent, so
a get would read zeros. UDB only sends the value IDs above.

Effect `0` turns the lighting off. Other effect numbers depend on which effects
the firmware was built with. VIA learns their names from the keyboard
definition, which UDB doesn't have, so UDB shows them as numbers. Out-of-range
effects are clamped by the firmware (`rgb_matrix_mode_eeprom_helper`), so the
read-back reports what was actually set.

## Brightness is quantised

The firmware scales brightness between the protocol's 0–255 and its own
maximum, which is set per board:

- RGB matrix: set `scale8(v, MAX)`, get `val × 255 / MAX`
- rgblight: set `v × LIMIT / 255`, get `val × 255 / LIMIT`
- backlight: set `v × LEVELS / 255`, get `level × 255 / LEVELS`

With `MAX = 255` the round trip is exact. With `MAX = 200`, writing 100 reads
back 99. UDB treats a brightness read-back within 2 of the request as
confirmed, and shows the value the keyboard returned. A bigger difference (few
backlight levels, a low limit) is a mismatch: the previous value is restored,
and the user sees the step the keyboard actually uses.

## Persistence

`07` changes RAM only. `09 ch` writes the channel to EEPROM. UDB's write sends
`07`, then `09`, then reads back. A restore after a mismatch saves the previous
value the same way, so EEPROM always holds the last value the keyboard
confirmed.

## Keymap commands (Phase 5)

`04` and `05` are refused until the user loads a VIA definition for this
keyboard. The definition gives the matrix size; the layer count comes from `11`.
The allowlist then accepts a position only inside `layers × rows × cols`.
(QMK itself returns `KC_NO` for a get outside the matrix and ignores a set
there.) A set also needs:

- a basic keycode (`<= 00FF`, the HID keyboard and consumer usages), or exactly
  a value the keyboard returned for that same key. The 16-bit space above `FF`
  holds layer, macro and quantum keycodes, including bootloader and
  EEPROM-clear keys, so UDB never assigns one that the keyboard didn't already
  hold at that key;
- no bytes past the keycode.

`05` stores to EEPROM at once (`dynamic_keymap_set_keycode`), so a restore after
a mismatch needs no separate save. Layout options (which key variants the board
was built with) are not read: `02 02` is not allowed, so the user chooses them
in the UI. Names and values of the basic keys are from QMK `keycodes.h` at
`7a1bbf37`.

## Refused by the allowlist

Everything not listed above. In particular:

- `0B` bootloader jump (removed from current QMK, still present in older and
  vendor forks), `0A` EEPROM reset, `06` keymap reset, `10` macro reset
- `0C` to `10`, `12`, `13`, `15`: macro, buffer and encoder commands (macros are
  not built). `04` and `05` are refused outside the loaded matrix and layers,
  and `05` with a keycode above `FF` that the keyboard didn't return for that key
- `02 03` switch matrix state: it reports which keys are held, which is
  keystroke data (THREAT_MODEL)
- `03` set keyboard value (layout options, device indication)
- channel `0` (keyboard-specific custom values, e.g. Keychron's) and channel
  `4` (audio)
- `FE` and above (Vial and vendor extensions)
- any command before the handshake, other than `01`

## Open questions (Phase 6, needs a VIA keyboard)

- Do Keychron's wireless boards answer VIA over the 2.4 GHz receiver, or only
  over the cable?
- Which boards set a brightness maximum below 255 (and so read back a
  different value)?
