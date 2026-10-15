# Protocol families: `corsair-nxp` and `corsair-bragi` (Corsair mice)

Status: **classic (NXP): experimental**, tested against replies OpenMouse read
from a NIGHTSWORD RGB. **Bragi: detection only.**

## Sources

| Source | What it gave | License | Use |
|---|---|---|---|
| OpenMouse mouse-protocol `src/corsair/index.ts`, `src/drivers/corsair/hid.ts`, `captures/corsair-nightsword/` (commit `e53af6d5`) | the classic protocol as verified on a NIGHTSWORD RGB (fw 3.41, Chrome WebHID, Windows 11), with replies and a live write probe | AGPL-3.0-or-later | code (ADR 8): `src/adapters/corsair-nxp.ts`; replies as fixtures |
| OpenMouse `src/corsair/bragi.ts`, `captures/corsair-ironclaw-rgb-wireless/` | the Bragi request layout, confirmed against iCUE's DPI writes (SETs only); GET layout and properties from ckb-next, OpenRGB and OpenLinkHub | AGPL-3.0-or-later | facts |
| ckb-next (`nxp_proto.h`) | the protocol's origin | GPL-2.0-only | not used (ADR 2); OpenMouse corrected two points on hardware |

## Classic protocol (`corsair-nxp`)

- Config interface: `FFC2:0004` (`MI_01`), 64-byte reports, report ID 0. The
  other interface also has an `FFC2` collection (usage 3) that refuses feature
  writes, so the registry names usage 4.
- **Feature reports.** GET: send `0E field sub 00`, wait ~20 ms, read with
  GET_FEATURE; the reply echoes bytes 0–3. SET: send `07 …`; **no reply**, so
  the buffer still holds the last GET. Every SET is confirmed by the matching
  GET.
- Byte 3 is the profile: 0 = live settings, 1 = stored profile (reads zeros
  on fw 3.41). UDB uses 0 only.
- **DPI byte order is asymmetric:** GET answers big-endian, SET takes
  little-endian.
- A stage write must carry the stage colour, or the colour is cleared. A write
  to a stage the mask doesn't enable is ignored.

| Bytes | Meaning | UDB |
|---|---|---|
| `0E 01 00` | identity: firmware, bootloader, VID/PID (LE), poll interval | read |
| `0E 13 05 00` | enabled-stage mask | read |
| `0E 13 02 00` / `07 13 02 00 n` | active stage (and its DPI) | read / write |
| `0E 13 Dn 00` / `07 13 Dn 00 0 xLE yLE r g b` | stage n: DPI, indicator colour (D0 = sniper) | read / write (X = Y, colour kept) |
| `0E 13 03 00` / `07 13 03 00 h` | lift-off height 1–5 | read / write |
| `0E 13 04 00` / `07 13 04 00 0\|1` | angle snapping | read / write |

**Persistence:** live writes are lost when the mouse powers off. It boots from
its onboard profile, whose file-based format UDB doesn't write. iCUE
re-applies its own profile on its own triggers, overwriting live changes. UDB
says so next to the controls.

**Refused:** the polling write (`07 0A`, which makes the mouse re-enumerate),
the stage-mask write (encoded by OpenMouse but never sent to hardware), the
profile name and ID fields, stored-profile traffic (byte 3 = 1, field `17`,
bulk `FF`), independent X/Y, DPI outside 100–26,000, and anything else.

## Bragi (`corsair-bragi`): detection only

Post-2019 Corsair peripherals (IRONCLAW RGB WIRELESS, SLIPSTREAM receivers)
speak Bragi: 64-byte output reports on usage page `0xFF42`, replies as input
reports, `[08|slot, command, property, 00, value LE]`. OpenMouse confirmed the
request layout against iCUE's DPI writes, but no GET reply was captured, and
the `0xFF42` collection's usage (which a browser filter needs) wasn't
recorded. UDB lists these devices and sends them nothing until a device report
and a read capture exist.

## Open questions (Phase 6)

- The stage-mask write and the polling write with reconnect.
- Bragi: the collection usage, and GET replies for DPI, battery and mode.
