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

## Recovered from the vendor driver (static, 2026-10-15)

Method: Ghidra 12.1.4 headless decompile of `DeviceDriver.exe` (sha256
`4f81d013ae78f389b936ff9b8f5560fbf51ddbd79061b67fd5e251575afb50c7`), REA
`binary_overview`/`search`/`xrefs` for the entry points. Function names below
are Ghidra's addresses in that build. Nothing has been sent to the keyboard.

### Transport

- The driver statically links hidapi (`FUN_00451390` is hidapi's
  `lookup_functions`: `LoadLibrary("hid.dll")` + `GetProcAddress`).
- **Commands are 64-byte feature reports with report ID 0**
  (`HidD_SetFeature`, buffer 0x41 = ID + 64; `FUN_00451ce0`).
- **Replies are read with GET_FEATURE** (`DeviceIoControl 0xB0192`
  = `IOCTL_HID_GET_FEATURE`; `FUN_00451d80`) a few ms later. The driver
  re-sends once when reply byte 3 is `0xFF` (`FUN_0044f960`).
- Between frames the driver sleeps `cmd_delaytime` (config key; the shipped
  `config.xml` doesn't set it). Payloads over 64 bytes are sent in 64-byte
  chunks.
- On the dev machine this is the `FF13:0001` interface (MI_03), the only one
  with 64-byte feature reports.
- **The driver never uses a reply's data**; replies only act as
  acknowledgements. It keeps its own copy of the settings in SQLite.

### Commands the driver sends

| Bytes 0–1 | Ack read? | Used by | Meaning (inferred) |
|---|---|---|---|
| `04 18` | yes | system settings, lighting, LCD | begin a write session |
| `04 17` (byte 2 = 1, byte 8 = 1) | yes | system settings | system-settings block follows |
| `04 13` (byte 8 = 1) | yes | lighting (`FUN_0042b0c0`, `FUN_00434350`) | lighting block follows |
| `04 20` (byte 8 = 3 or 8) | yes | per-key lighting, key map | key table (0xC0 or 0x200 bytes) follows |
| `04 19`, `04 15` | yes | macros (`FUN_0042d830`) | macro data |
| `04 72`, `04 28` | yes | LCD image (`FUN_00422b20`, `FUN_00423ae0`) | image upload |
| `04 02` | yes | all of the above | end the session |
| `04 F0` | no | after lighting | unknown; possibly "apply" or "save" |

### Blocks

- **System settings** (after `04 17`): `00 01`, then three checkbox flags
  (bytes 2–4), `fn_switch` (byte 5), `sleep_time` (byte 6),
  `key_respondtime` (byte 8). Bytes 62–63 = `AA 55`.
- **Lighting** (after `04 13`): byte 0 = mode, bytes 1–3 = colour, bytes 8–11
  = four values from the driver's profile record, bytes 14–15 = `AA 55`.

## Same OEM family: XVX G75 (independent research)

The [XVX G75 reverse-engineering notes](https://github.com/youssefvdel/xvx-g75-linux-driver)
(no license, so UDB uses them for facts only) describe a keyboard with the
**same borrowed `05AC:024F`**, 64-byte feature reports, the `0x04` command
family, an `AA 55` signature and a TFT screen. Commands its author confirmed
on hardware:

- `04 12 <profile>` → **read the lighting config**. Reply:
  `<mode> c c c 00 00 00 00 <profile> <brightness> <speed> 00 00 00 AA 55`,
  with `AA 55` marking a configured profile. **That layout matches the
  lighting block Mechlands' driver writes after `04 13`.**
- `04 10 <page>` → read a key-map page.
- `04 01 …` → set runtime lighting (not persisted).
- `01` → "INIT/Reset". **UDB never sends it.**
- Reply byte 3 is a status byte (`FF` idle, `01` busy).

## UDB plan

1. **Read-only probe** on the owner's Vibe75: `04 12 p` for p = 0–4, then
   decode. Confirms the family and finds the active profile.
2. **Write** by replaying the vendor's exact lighting sequence (`04 18`,
   `04 13`, block, `04 02`, `04 F0`), changing one field of the block that was
   just read. Then **read back** with `04 12`, and check again after
   unplug/replug.
3. The allowlist admits only those frame shapes. `01`, key, macro, LCD,
   system-settings and firmware traffic stay refused.

## Open questions

- Which interface carries commands (MI_03 assumed) and whether it uses feature
  or output reports.
- Whether settings persist on the keyboard (needed for the unplug/replug test).
- Whether the BLE connection exposes the same vendor collection.
- Whether the protocol matches another brand's already-documented protocol
  (Epomaker, AULA). Check before reverse-engineering from scratch.
