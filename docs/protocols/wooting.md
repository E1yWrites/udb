# Protocol family: `wooting` (Wooting analog keyboards)

Status: **detection only.** UDB recognises Wooting boards by VID/PID and sends
them nothing. This note records why, and what it would take to do more.

## Sources

| Source | What it gave | License | Use |
|---|---|---|---|
| Wooting RGB SDK `src/wooting-usb.c`, `src/wooting-usb.h` (commit `451f40dc`) | board PIDs and names, the config interface's usage pages (`0x1337`, and `0xFF55` for multi-report firmware), the 8-byte feature command `[index, D0\|D1, DA, cmd, p3, p2, p1, p0]` with the reply read back as an input report, and the layout byte of the device-config reply | MPL-2.0 | facts: the registry entries |
| OpenMouse mouse-protocol `src/wooting/index.ts`, `src/drivers/wooting/hid.ts` (commit `e53af6d5`) | read-only command IDs (`01` version, `13` device config, `0B` active profile, `27` profile, `33` settings); one 60HE+'s version and device-config replies; command IDs it deliberately avoids (`02` bootloader, `15` keys off, `19` soft reset) | AGPL-3.0-or-later | facts |
| Wootility (web app) | the only tool that writes Wooting settings | proprietary | not used |

## Why there is no adapter

- **No documented write path with read-back.** Actuation, rapid trigger and
  keymaps are written by Wootility as protobuf blobs over multi-report
  packets. That format is not public, and OpenMouse only reads it.
- **Lighting can't be verified.** The RGB SDK's colour commands set live
  colours with no read-back, so they could never reach `write-verified`. They
  are also not settings stored on the keyboard.
- **The read path is unsettled.** OpenMouse's notes disagree on the framing.
  One file calls the 60HE+ a single-report board using magic `D0`; the replies
  it captured start with `D1 DA`, which the SDK uses for multi-report
  (`0xFF55`) firmware. Its notes also disagree on whether that collection
  declares a feature report, which UDB's transport would need to know.
- **The analog stream is keystroke data.** Collection `FF53:0001` reports
  live key travel. It is on the deny list of every Wooting entry.

## What would unblock it

1. A device report from a Wooting board (`Copy device report`). It shows which
   collections declare which reports.
2. A read-only capture of Wootility's WebHID traffic while it reads, then
   changes, one setting. Wootility is a web app, so this works from Chrome's
   DevTools without USB capture.
3. Then: an allowlist for version, device config and settings reads, and a
   documented settings write with read-back, if the capture shows one.

## Boards

From the SDK. Each HE-generation board also answers on `base | 1` and
`base | 2`, the PIDs its firmware uses for gamepad modes.

| Board | PID |
|---|---|
| Wooting One | `03EB:FF01`, `31E3:1100` |
| Wooting Two | `03EB:FF02`, `31E3:1200` |
| Two Lekker Edition | `1210` |
| Two HE, Two HE (ARM) | `1220`, `1230` |
| 60HE, 60HE (ARM), 60HE+, 60HE V2 | `1300`, `1310`, `1320`, `1340` |
| 80HE | `1400` |
| UwU, UwU RGB | `1500`, `1510` |
