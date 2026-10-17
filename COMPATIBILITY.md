# Compatibility research matrix

**This is a research and feasibility table, not a support claim.** No device
on it is supported by UDB yet. The support matrix will be generated from
`registry/` once Phase 2 lands. This file only ranks where to spend effort.

Market signal: pro-player usage share, end of June 2026
([ProSettings](https://prosettings.net/blog/best-pro-gaming-gear-summer-2026/)).
It reflects pros, not retail sales. Mice: Razer 36%, Logitech 35%, ZOWIE 8%.
Keyboards: Wooting 30%, Razer 25%, Logitech 15%. Headsets: Razer 31%,
HyperX 26%, Logitech 17%. Retail share data was not freely available.

Column meanings:
- **Reference:** the best open protocol source and its license (checked
  2026-10-15).
- **WebHID:** whether the configuration interface is reachable from a browser.
  ✅ = vendor usage page, or feature reports on a mouse/keyboard collection
  (allowed by Chromium's `IsAlwaysProtected`); ❓ = not checked.
- **Read-back:** whether settings can be read back, which `write-verified`
  requires.
- **Owned:** whether the user has the hardware.

## Mice

| Brand | Protocol family | Reference (license) | WebHID | Read-back | Owned | Plan |
|---|---|---|---|---|---|---|
| Pulsar | `compx` | Pulsar Bibimbap web driver (proprietary; facts only) | ✅ `FF02:0002` | ✅ flash read | **X2 CrazyLight** | **Phase 3** |
| Logitech G | HID++ 2.0 | OpenMouse (AGPL-3.0-or-later), libratbag (MIT), Solaar (GPL-2.0-or-later) | ✅ `FF00:0001/0002`, `FF43:0202` | ✅ | – | Phase 4, #2: experimental |
| Razer | Razer protocol | OpenMouse (AGPL-3.0-or-later), OpenRazer (GPL-2.0-or-later, facts) | ✅ undeclared feature report 0 on the mouse collection | ✅ | – | Phase 4, #3: experimental |
| ZOWIE | none known (switches on the mouse itself) | – | – | – | – | detect only |
| SteelSeries | rivalcfg family | rivalcfg (WTFPL) | ❓ | ⚠️ mostly write-only | – | Phase 4, later |
| Corsair | classic (NXP) and Bragi | OpenMouse (AGPL-3.0-or-later; NIGHTSWORD hardware notes), ckb-next (GPL-2.0-only, not used) | ✅ `FFC2:0004` feature reports; Bragi `FF42` usage unknown | ✅ classic, live settings only | – | Phase 4 long tail: classic experimental, Bragi detection only |
| HyperX | NGENUITY HID | OpenRGB (GPL-2.0-or-later), lighting only | ❓ | ❓ | – | Phase 4, later |
| ASUS ROG / TUF | Aura (about ten sub-protocols) | OpenRGB (GPL-2.0-or-later), asusctl (MPL-2.0); facts only | ❓ collections unknown | ❌ lighting is write-only | – | Phase 4 long tail: **detection only** (55 keyboards and mice) |
| Glorious | Sinowealth-based | OpenRGB (lighting) | ❓ | ❓ | – | Phase 4, later |
| Turtle Beach / Roccat | Roccat | libratbag (MIT) | ❓ | ✅ (libratbag reads) | – | Phase 4, later |

**Phase 4 update (2026-10-15):** ATK and VXE turned out to be the same
`compx` platform as Pulsar. 169 ATK/VXE models are in the registry as
experimental (generated from OpenMouse's copy of the ATK HUB catalog; see
`docs/protocols/compx.md`). The owner no longer has the VXE R1 SE+.

**Phase 4 update (2026-10-15):** Logitech HID++ 2.0 is in: 61 mice and
keyboards generated from libratbag's device data and OpenMouse's list, plus one
entry that matches any Logitech HID++ interface (receivers, unlisted models).
DPI, report rate and battery are `experimental`. See
`docs/protocols/logitech-hidpp.md`.

**Phase 4 update (2026-10-15):** Razer is in: 82 mouse models (111 product
IDs) from OpenMouse's audit of OpenRazer. DPI, polling, battery, auto sleep and
the low-power threshold are `experimental`. The codec replays two real
DeathAdder V3 Pro captures byte for byte. See `docs/protocols/razer.md`.

**Phase 4 update (2026-10-15):** Wooting is **detection only**. Twelve boards
from the official RGB SDK are in the registry, and UDB sends them nothing. No
configuration protocol with read-back is public; `docs/protocols/wooting.md`
says what would unblock it.

**Phase 4 update (2026-10-15):** Headsets. Fourteen Logitech HID++ headsets
(from HeadsetControl's list) get battery and sidetone through the Logitech
adapter, both `experimental`. Sidetone reads back, so it can be verified once
someone with the headset tests it. Five HyperX headsets are detection only
until a device report shows their collections (`docs/protocols/hyperx.md`).

**Phase 4 update (2026-10-15):** HID LampArray is in: one descriptor-driven
adapter for any device exposing `0059:0001` (Windows Dynamic Lighting), plus
the G14's own entry. Lamp attributes read back; colours are sent and labelled
as unconfirmed. See `docs/protocols/lamparray.md`.

**Phase 4 update (2026-10-15):** Corsair. The classic protocol (NIGHTSWORD
RGB) has DPI stages, active stage, lift-off and angle snapping, all live
settings that are lost at power-off. They are tested against OpenMouse's
hardware replies. Bragi devices (IRONCLAW RGB WIRELESS, SLIPSTREAM receiver)
are detection only. See `docs/protocols/corsair.md`.

**Phase 4 update (2026-10-17):** ASUS Aura. It is about ten sub-protocols, all
lighting, none with read-back. 55 ROG and TUF keyboards and mice (73 product
IDs, from OpenRGB's tables) are listed as detection only. The G14 stays on
LampArray. See `docs/protocols/asus-aura.md`.

## Keyboards

| Brand | Protocol family | Reference (license) | WebHID | Read-back | Owned | Plan |
|---|---|---|---|---|---|---|
| Mechlands Vibe75 (not on the list; owned) | unidentified vendor | vendor MFC app (needs Ghidra and capture) | ✅ `MI_03` `FF13` (hypothesis) | ❓ | **Vibe75** | **Phase 3** |
| Keychron and other QMK boards | QMK/VIA | VIA (GPL-3.0), QMK (GPL-2.0-or-later) | ✅ `FF60:0061` | ✅ | – | Phase 4, **#1**: experimental |
| Wooting | Wooting | Wootility (web app, proprietary), Wooting RGB SDK (MPL-2.0) | ⚠️ `FF55:0001`; framing unsettled | ❌ no documented write with read-back | – | Phase 4, #4: **detection only** |
| Razer | Razer protocol | OpenRazer (GPL-2.0-or-later) | ✅ | ✅ | – | with Razer mice |
| Logitech G | HID++ 2.0 | Solaar, libratbag | ✅ | ✅ | – | with Logitech mice: report rate experimental |
| ASUS ROG (incl. laptops) | LampArray (Aura: detection only for desktop devices) | HID Usage Tables 1.4; Microsoft LampArray reference (MIT); OpenRGB for Aura | ✅ `FF31`, LampArray `0x59` | ⚠️ LampArray: attributes read back, colours write-only | **G14 built-in** | Phase 4, #6: LampArray experimental |
| SteelSeries, Corsair, HyperX, MSI | vendor protocols | OpenRGB (lighting) | ❓ | ❓ | – | Phase 4, later |
| Ducky | mostly no software | – | – | – | – | detect only |

**Phase 4 update (2026-10-15):** QMK/VIA is in as one generic registry entry
(`qmk/via-keyboard`) that matches any keyboard exposing `FF60:0061`. Lighting
(brightness, effect, speed, colour) is `experimental`. Keymap and macros wait
for VIA definitions (Phase 5). See `docs/protocols/qmk-via.md`.

## Headsets

| Brand | Protocol family | Reference (license) | WebHID | Read-back | Owned | Plan |
|---|---|---|---|---|---|---|
| SteelSeries Arctis | `steelseries-arctis` | HeadsetControl (GPL-3.0) | ✅ `FFC0:0001` | ⚠️ Nova 7: only sidetone on Gen 2 | – | **Phase 3, experimental only** |
| HyperX Cloud | HyperX (one protocol per model) | HeadsetControl (GPL-3.0) | ❓ collections unknown | ⚠️ battery only | – | Phase 4, #5: **detection only** |
| Logitech G | HID++ 2.0 | HeadsetControl (GPL-3.0), Solaar | ✅ `FF43:0202` | ✅ sidetone, battery | – | Phase 4, #5: experimental |
| Razer BlackShark | unknown | no open reference | ❓ | ❓ | – | research gap (top pro share) |
| Corsair, Audeze, Sony INZONE, Turtle Beach | various | HeadsetControl (partial) | ❓ | ⚠️ | – | Phase 4, later |
| ASUS ROG, JBL Quantum | unknown | none found | ❓ | ❓ | – | research gap |

Features that run on the PC (virtual surround, THX, Sonar EQ, software
macros) are **"needs companion"** and never appear as device controls.

## Proposed changes to the brand lists

- **ZOWIE and Ducky:** keep them as "detect only". Neither has a known
  configuration protocol.
- **JBL Quantum and ASUS ROG headsets:** keep them as research gaps. No open
  reference was found.
- **Opportunistic `compx` coverage:** other `compx` brands (Pulsar routes VID
  `0x3554` there) get added only once a device is in hand.
