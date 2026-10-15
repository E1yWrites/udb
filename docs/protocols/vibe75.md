# Protocol family: Mechlands Vibe75 (family not yet identified)

Status: **research only.** The command bytes are not known yet. Nothing has
been sent to the device.

## Sources

| Source | What it gave | Identity |
|---|---|---|
| Mechlands "Vibe75 V2 Driver" page, `Mechlands_Vibe_75_Driver-1.0.0.0.zip` | Inno Setup 6.1 installer → native MFC app `DeviceDriver.exe` + `mui.dll` | zip sha256 `1ed2165f94630577cebf53094063f86af0cb843109a28a588e89bc8c85fe4c16` |
| `config.xml` inside the installer | Device matching and interface routing | below |
| Windows `HidP_GetCaps` on the dev machine (descriptor metadata only, no reports sent) | Per-collection report sizes | below |

The installer's copyright line names 深圳市畅韵科技有限公司 (Shenzhen
Changyun Technology) as the OEM. Mechlands' store also sells Epomaker, AULA and
Ajazz, so the protocol may be shared with other brands. That is **unverified.**

## Identification

The keyboard uses Apple's vendor ID instead of its own: `05AC:024F` in both
modes, per `config.xml`.

| Mode | `product_name` | Interface the driver names |
|---|---|---|
| USB | Mechlands Vibe75 | `MI_00` |
| 2.4G dongle | 2.4G Dongle | `MI_03` |

On the dev machine, the keyboard is connected by USB and also paired over BLE
as "Vibe75-1".

Collections, wired (lengths include the report-ID byte):

| Interface | Usage page:usage | In | Out | Feature | WebHID |
|---|---|---|---|---|---|
| MI_00 | 0001:0006 keyboard | 9 | 2 | 0 | input/output blocked; it has no feature reports |
| MI_01 COL01 | 000C:0001 consumer | 3 | – | – | open |
| MI_01 COL02 | 0001:0080 system control | 2 | – | – | blocked |
| MI_01 COL03 | 0001:0006 keyboard (NKRO) | 16 | – | – | blocked |
| MI_01 COL04 | 0001:0002 mouse | 5 | – | – | blocked |
| MI_01 COL05 | FFFF:0001 vendor | 4 | – | – | open |
| MI_02 | FF68:0061 vendor | 65 | 4097 | – | **open** (the 4 KB output fits screen-image upload) |
| MI_03 | FF13:0001 vendor | 65 | 65 | 65 | **open** (likely command channel) |

`MI_00` has no feature reports, and Chromium blocks input and output reports on
keyboard collections (`IsAlwaysProtected` in
`services/device/public/cpp/hid/hid_report_utils.cc`). So the driver can't be
configuring the keyboard through `MI_00` alone. The working hypothesis:
`config.xml`'s `MI_00` only identifies the device, and commands go through
`MI_03`. **To be confirmed in Phase 3.**

WebHID on 2026-10-15 (Edge 155, Windows 11) shows exactly the two vendor
interfaces, `FF68:0061` and `FF13:0001`, neither using report IDs (ID 0), with
the sizes above. The protected keyboard, mouse and system-control collections
are not exposed, as expected.

## Driver features (from exported UI class names, not protocol facts)

Custom per-key lighting (`CustomLightMode::SetKeyMap`, `SetKeyInfo`), key
layers (`KeyLayerButton`), an LCD screen with RGB565 image and GIF frames
(`LCDViewList::GetImageRGB565Data`), macros, and an `UpgradeButton` that runs
`temp\FirmwareUpdateTool.exe`. **UDB never touches the firmware tool or the
`firmware/` directory.**

## Plan to recover the protocol (Phase 3)

1. **Ghidra** on the Linux side (JDK 21 + Ghidra, no root needed), then
   `open_binary` on `DeviceDriver.exe` through REA. Look for the callers of
   `HidD_SetFeature`, `HidD_GetFeature`, `WriteFile` and `ReadFile`, and the
   buffers they build.
2. **Wireshark + USBPcap** on Windows (needs admin; it installs a kernel filter
   driver). Capture the vendor app while changing one setting at a time, on
   the user's own keyboard.
3. Cross-check each static finding against a capture before writing any
   adapter code. Every command and its effect goes into the allowlist table
   here, with the evidence that backs it.

## Open questions

- Which interface carries commands (MI_03 assumed) and whether it uses feature
  or output reports.
- Whether settings persist on the keyboard (needed for the unplug/replug test).
- Whether the BLE connection exposes the same vendor collection.
- Whether the protocol matches another brand's already-documented protocol
  (Epomaker, AULA). Check before reverse-engineering from scratch.
