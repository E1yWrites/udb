# Protocol family: `steelseries-arctis` (Arctis Nova 7 first)

Status: **research only. No hardware on hand.** Facts come from
HeadsetControl (GPL-3.0, which UDB may port because UDB is GPL-3.0-or-later),
`lib/devices/steelseries_arctis_nova_7.hpp` at `master` on 2026-10-15. A
simulator or replay can make this adapter at most `experimental`.

## Identification

- VID `0x1038`. Nova 7 PIDs: `0x2202`, `0x22A1`, `0x227E` (Gen 2), `0x2206`,
  `0x2258`, `0x229E`, `0x22AD`, `0x223A`, `0x22A9`, `0x227A`, `0x22A4`,
  `0x22A5`. The Nova 7P (`0x220A`) is a separate class.
- Command collection: usage page `0xFFC0`, usage `0x01`, interface 3. That's a
  vendor page, so WebHID can reach it.
- Battery encoding differs by PID: discrete 0–4 on older firmware, a
  percentage on newer PIDs.

## Commands (output reports, from HeadsetControl)

| Setting | Bytes | Range | Can be read back? |
|---|---|---|---|
| Sidetone | `00 39 v` | 0–3 | **Only on `0x227E`**: request `00 20`, reply starts `0x20` |
| Save (Gen 2) | `00 09` | – | – |
| Inactive time | `00 A3 minutes` | minutes | no |
| Equalizer (10 bands) | `00 33 b0..b9 00` | 0x14 ± gain | no |
| EQ presets | sent as the EQ command with preset values | 0–3 | no |
| Mic-mute LED | `00 AE v` | 0–3 | no |
| Mic volume | `00 37 v` | 0–7 | no |
| Volume limiter | `00 3A 0/1` | bool | no |
| BT when powered on | `00 B2 0/1`, then save `06 09` | bool | no |
| BT call volume | `00 B3 v` | 0–2 | no |
| Status (battery, chatmix) | status report `0xB0` (arrives asynchronously) | – | read only |

## Consequence for the registry

Under UDB's rules, a setting without read-back can never be `write-verified`.
On the Nova 7, only **sidetone on the Gen 2 (`0x227E`)** can reach
`write-verified`. All the other writes ship as `experimental`, labelled
"sent, device does not report back". If a headset is bought for the Phase 3
headset criterion, it should be the **Nova 7 Gen 2**.

## Adapter

`src/adapters/steelseries-arctis.ts` is ported from HeadsetControl. Its
allowlist covers status (`B0`), the settings read (`20`), sidetone (`39`,
0–3), save (`09`), and auto power-off (`A3`, ≤ 90 min). EQ, mic, Bluetooth
and volume-limiter commands are refused until a headset is available to verify
them. `tests/steelseries-arctis.test.ts` checks the encoding against bytes
derived from HeadsetControl's source; nothing was captured from hardware.
There is no UI for this adapter yet, because no one can test it.

## Open questions

- The exact status request bytes. Check the shared SteelSeries base class in
  HeadsetControl.
- Whether SteelSeries GG/Sonar holds interface 3 while running.
- Whether settings persist through a power cycle (the unplug test) on Gen 2.
