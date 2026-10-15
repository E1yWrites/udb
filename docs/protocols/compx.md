# Protocol family: `compx` (Compx CX52650N wireless mouse platform)

Status: **research only.** Everything below comes from static reading of
Pulsar's shipped web driver. Nothing has been sent to a device. No feature is
`read-verified` or `write-verified` yet.

## Sources

| Source | What it gave | Identity |
|---|---|---|
| `https://bbb.pulsar.gg/` (Bibimbap launcher, v1.3.12) | VID/PID → sub-driver routing (`cfg.json`) | `cfg.json` sha256 `ab0af13d…892548`; `app.3283b4c5.js` sha256 `2b380afd…376194` |
| `https://bbb.pulsar.gg/cMouse/` (mouse sub-driver) | Command enum, framing, checksum, flash map, per-model config | `app.6842ab2c.js` sha256 `6d509369…69cfd`; `cfg.json` sha256 `2be8ae7c…80e17` |
| REA `analyze_javascript_application` on the launcher | Artifact identity and inventory; its graph does not model WebHID calls, so byte layouts were read from the formatted source | Evidence `ev_345f680d15b8a472ac333d9a75be83a17f4393d983131d14f5b3b334b336721f` |

Pulsar's code is proprietary. UDB uses these facts and reuses none of its
code. The language file states: "Supported models: X2&Xlite Crazylight series,
Tenz series, X2F series, JV-X (X series)".

## Identification

- Pulsar routes VID `0x3710` with PIDs including `0x5406` (the 8K dongle on the
  dev machine) and VID `0x3554` PID `0xF40A` to the same `/cMouse` driver.
  `0x3554` is a second vendor ID using this platform. Which brand it belongs to
  is **unknown**.
- Chips named in the model config: mouse `NRF52833`, dongles `CX52650N` and
  `CH32V305`.
- The driver picks the HID collection that has exactly one input report and
  one output report, both with **report ID `0x08`**. On the dev machine,
  `HidP_GetCaps` (descriptor metadata only) shows exactly one dongle collection
  with 17-byte input and output reports (16 bytes plus the report ID):
  `MI_01` `FF02:0002`. **Confirmed by WebHID on 2026-10-15:** `FF02:0002`
  declares report `0x08` with 16-byte input and output on both the dongle
  (`3710:5406`) and the mouse on its cable (`3710:3414`, product string
  "Pulsar X2 CrazyLight"). The dongle also exposes `FF06:0002` (report 9,
  48 bytes in/out), which the wired mouse lacks; its use is unknown.
- A device is identified by **CID/MID**, not by PID. The `EncryptionData`
  response carries `cid` = byte 9, `mid` = byte 10, `type` = byte 11. Pulsar's
  model table uses CID 87 and MIDs 1–149. The CrazyLight Bruce Lee edition's
  MID is **unknown until it's read from the device**.
- `type` → connection and maximum polling rate: 0 = wireless 1 kHz,
  1 = wireless 4 kHz, 4 = wireless 2 kHz, 5 = wireless 8 kHz, 2 = wired 1 kHz,
  3 = wired 8 kHz.

## Framing

Output report `0x08`, 16-byte payload:

| Byte | Meaning |
|---|---|
| 0 | command |
| 1 | status (0 in requests) |
| 2–3 | flash address, big-endian (flash commands) |
| 4 | length (≤ 10) |
| 5–14 | data |
| 15 | checksum |

**Checksum:** `(0x55 − (sum(bytes[0..14]) + 0x08)) & 0xFF`. The report ID is
part of the sum.

**Response:** input report `0x08`. The driver treats a response as an ack when
bytes 0–2 match the request (bytes 0–4 for `ReadFlashData`). Status byte 1:
`0` means OK, `1` appears to mean "command not supported" (inferred, because
the driver then hides that feature). The driver tries up to 5 times and polls
every 5 ms, up to 40 polls per try.

## Commands

UDB's proposed allowlist class for each command is shown. Only rows marked
**allow** may go into the Phase 3 adapter's allowlist.

| ID | Name (from the driver) | UDB class |
|---|---|---|
| 1 | EncryptionData (info handshake, 4 random bytes) | **allow** (read: returns cid/mid/type) |
| 2 | PCDriverStatus | investigate (effect unknown) |
| 3 | DeviceOnLine | **allow** (read: online flag, 3-byte address) |
| 4 | BatteryLevel | **allow** (read: level, charging) |
| 5 | DongleEnterPair | deny (pairing; Phase 5 at the earliest) |
| 6 | GetPairState | deny (pairing) |
| 7 | WriteFlashData | **allow, address-restricted** (see the flash map) |
| 8 | ReadFlashData | **allow** |
| 9 | ClearSetting (factory reset) | deny (destructive; needs its own decision) |
| 10 | StatusChanged (unsolicited, from the device) | receive only |
| 11 | SetDeviceVidPid | **deny permanently** |
| 12 | SetDeviceDescriptorString | **deny permanently** |
| 13 | EnterUsbUpdateMode | **deny permanently** (firmware) |
| 14 / 15 | Get/SetCurrentConfig (profile) | investigate |
| 16 | ReadCIDMID | allow (read) |
| 17 | EnterMTKMode | **deny permanently** (looks like a factory/bootloader mode) |
| 18 | ReadVersionID | allow (read) |
| 20 / 21 | Set/Get4KDongleRGB | investigate |
| 22 / 23 | Set/GetLongRangeMode | investigate |
| 24–42 | Pulsar dongle light/key/O-button settings | investigate |
| 29 | GetDongleVersion | allow (read) |
| 43 | GetRSSIValue | allow (read) |
| 176 / 177 | MusicColorful / MusicSingleColor | deny (host-driven effect, "needs companion") |
| 240 | WriteKBCIdMID | **deny permanently** (rewrites identity) |
| 241 | ReadKBCIdMID | allow (read) |

The launcher also implements firmware upgrade and dongle pairing (it downloads
`*.bin` images). UDB implements neither.

## Flash map (settings stored on the device)

Writes are `WriteFlashData(addr, len, data)`; reads are
`ReadFlashData(addr, len)`, with the response data in bytes 5+. On connect,
the driver reads addresses 0–255 in 10-byte chunks into a mirror. On 3955
sensors it also reads `0x1B00`–`0x1B30`.

| Addr | Setting | Encoding |
|---|---|---|
| 0x00 | Report rate | `[v, 0x55−v]`. v = 1000/Hz up to 1 kHz (1, 2, 4, 8); v = Hz/2000×16 above it (16, 32, 64) |
| 0x02 | Number of DPI stages | `[v, 0x55−v]` |
| 0x04 | Current DPI stage | `[v, 0x55−v]` |
| 0x0A | Lift-off distance | `[v, 0x55−v]` |
| 0x0C + 4·n | DPI stage n | `[x_lo, y_lo, hi_bits, csum]`; sensor-specific value table |
| 0x2C + 4·n | DPI stage colour n | `[r, g, b, csum]` |
| 0x4C–0x52 | DPI effect mode/brightness/speed/state | pairs |
| 0x60 | Key functions | per-button records |
| 0xA0 | Light | 7 bytes |
| 0xA9 | Debounce time | `[v, 0x55−v]` |
| 0xAB | Motion sync | `[v, 0x55−v]` |
| 0xAD | Sleep time | `[v, 0x55−v]` |
| 0xAF / 0xB1 / 0xB3 | Angle snap / ripple control / moving-off light | pairs |
| 0xB5 / 0xB7 / 0xB9 | Performance state / performance / sensor mode | pairs |
| 0xBD / 0xBF | Angle tune / state | pairs |
| 0xD7 / 0xD9 | Power-save battery / time | pairs |
| 0xE7 | Fan mode | pair |
| 0x100 | Shortcut keys | records |
| 0x300 | Macros | records |
| 0x1B00 + 6·n | 3955-sensor DPI stage n | `[x_lo, x_hi, y_lo, y_hi, hi_bits, csum]` |

A record checksum `csum` is `0x55 − sum(preceding bytes)`. A single-byte
setting is stored next to its complement (`0x55 − v`), which gives a built-in
integrity check on read-back.

DPI → register conversion depends on the sensor type (`pulsar x1`, `3950`,
`3955`, `3315`, `OM76`) and a per-sensor range/step table held in the driver
code, not in `cfg.json`. That table is a Phase 3 extraction task.

## Persistence and recovery

- Settings live in device flash, so they should survive unplugging. That's an
  inference from the command names and the read-on-connect behaviour, **not
  yet observed.**
- `StatusChanged` (10) arrives unsolicited. Bits in byte 5 tell the driver to
  re-read groups of settings, which suggests that on-mouse buttons (DPI switch)
  change flash.
- Before writes, the driver polls `DeviceOnLine` until byte 5 = 1 (mouse awake
  and linked). It treats byte 9 = 1 as "busy, retry".

## Write procedure for UDB (proposed)

1. Check the value against the capability range in the registry.
2. `WriteFlashData` to an **allowlisted address only**, value plus complement.
3. `ReadFlashData` of the same address and length.
4. Compare. On mismatch, write back the previous mirror value, read it back
   again, and report both results.

## Open questions (Phase 3)

- The CrazyLight's MID and sensor type. Read via `EncryptionData` (read-only).
- What `PCDriverStatus` does (does the mouse change behaviour while a "driver"
  is present?).
- Whether Pulsar's desktop "Fusion" app or another open Bibimbap tab holds the
  interface.
- Whether settings survive unplugging (the success test).
