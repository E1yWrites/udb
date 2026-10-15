# Protocol family: `asus-aura` (ROG laptop keyboards)

Status: **not researched.** This is a Phase 4 target. So far there is only
descriptor metadata from the dev machine's ROG Zephyrus G14 (GA403),
`0B05:19B6`, read with `HidP_GetCaps` (no reports sent):

| Collection | Usage page:usage | In | Out | Feature | Notes |
|---|---|---|---|---|---|
| COL01 | FF89:0010 | – | – | 63 | vendor |
| COL02 | FF89:FF0F | 2 | – | – | vendor |
| COL03 | FF82:00CF | 17 | 61 | 61 | **"ASUS Component Firmware Update". Denied.** |
| COL05 | FF31:0076 | 2 | – | 63 | Aura (per OpenRGB naming) |
| COL06 | FF31:0079 | 33 | 128 | 128 | Aura |
| COL07 | 0059:0001 | – | – | 51 | HID LampArray (Windows Dynamic Lighting) |

References for later: OpenRGB `AsusAuraUSBController` (GPL-2.0-or-later) and
the HID LampArray usage page in the HID Usage Tables.
