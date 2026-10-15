# Protocol family: `razer` (Razer 90-byte control reports)

Status: **experimental.** No Razer device has talked to UDB yet. The codec is
tested against two real captures OpenMouse recorded from a DeathAdder V3 Pro
(486 feature reports each, over the cable and the HyperSpeed receiver), and
against a simulator.

## Sources

| Source | What it gave | License | Use |
|---|---|---|---|
| OpenMouse mouse-protocol `src/razer/codec.ts`, `src/razer/devices.ts`, `src/drivers/razer/hid.ts`, `docs/razer-testing.md` (commit `e53af6d5`) | packet layout, checksum, status codes, commands, decoders, timing, the per-product table (transaction IDs, polling command, DPI ceiling, battery) | AGPL-3.0-or-later | code (ADR 8): ported into `src/adapters/razer.ts`; the table is vendored in `third_party/openmouse/razer-devices.ts` |
| OpenMouse `captures/razer-deathadder-v3-pro/*-roundtrip-2026-09-15.hex` | every report of two hardware write sessions (DPI, polling, auto sleep, low power), serial redacted | AGPL-3.0-or-later | test fixtures (`tests/fixtures/openmouse-razer-*.hex`) |
| OpenRazer (`driver/razermouse_driver.c`, `razercommon.c`), as audited by OpenMouse | transaction IDs per product, storage bytes | GPL-2.0-or-later | facts only |

## Transport

- **Feature report, report ID 0, 90 bytes**, sent with `sendFeatureReport` and
  answered through `receiveFeatureReport`.
- The control channel is the interface whose **only** collection is Generic
  Desktop Mouse (`0001:0002`). Chromium blocks input and output reports on
  mouse collections but allows feature reports (SPEC).
- **Razer does not declare this report in its descriptor.** It works because
  WebHID does not check report IDs. UDB's transport refuses undeclared reports
  unless the registry says otherwise, so Razer entries mark the collection
  `undeclaredFeatureReports` for report 0. That exception covers feature
  reports on that one collection only.
- A receiver can expose two mouse collections with the same name; only one
  answers. UDB tries each granted mouse interface until one replies.
- OpenMouse reports a Viper Ultimate receiver (`0x007B`) where Chrome strips
  the feature reports from every collection. No browser can reach it.

## Packet

| Byte | Field |
|---|---|
| 0 | status: request `00`; reply `01` busy, `02` ok, `03` failure, `04` timeout, `05` unsupported |
| 1 | transaction ID: `1F`, `3F` or `FF`, fixed per product. A wrong one gets no reply at all. |
| 2–4 | remaining packets, protocol type (always 0 here) |
| 5 | data size |
| 6 | command class |
| 7 | command ID (bit 7 set = get, clear = set) |
| 8–87 | arguments |
| 88 | checksum: XOR of bytes 2–87 |
| 89 | reserved, 0 |

Exchange: send, wait 100 ms, read the reply. A busy reply means "read again
later" (up to six reads). A bad checksum or the wrong command means a lost
exchange, so the request is sent again (up to six sends). A reply naming
another command can be a stale reply to an earlier request. Only a get may be
repeated after one; a set is never sent twice for it.

## Commands UDB sends

| Class/ID | Size | Arguments | Reply | Note |
|---|---|---|---|---|
| `00/81` | 2 | – | `[major, minor]` | firmware version |
| `07/80` | 2 | – | `[0, level]` | battery, level on a 0–255 scale |
| `07/84` | 2 | – | `[0, 1 = charging]` | some models answer `05` unsupported |
| `07/83`, `07/03` | 2 | seconds, big-endian | same | idle sleep, 60–900 s (the vendor's slider) |
| `07/81`, `07/01` | 2 | `[level 0–255, 0]` | same | low-battery threshold. Its level is in the *first* byte, unlike battery. |
| `04/85` | 7 | `[storage]` | `[storage, x, y, 0, 0]` | DPI. Storage `01` on most models, `00` on the DeathAdder V2 generation. |
| `04/05` | 7 | `[storage, x, y, 0, 0]` | echo | DPI write, X = Y |
| `00/85`, `00/05` | 1 | `[1000 / Hz]` | same | legacy polling: 125, 500, 1000 Hz |
| `00/C0`, `00/40` | 2 | `[selector, 8000 / Hz]` | same | extended polling up to 8000 Hz. Some products need a second write with selector `01` (on transaction `FF` for the HyperPolling dongle). |

Polling changes briefly reconfigure the wireless link, so UDB waits 150 ms
before the read-back.

## Persistence

Storage byte `01` is the persistent store. OpenMouse's DeathAdder V3 Pro
sessions show DPI, auto sleep and low power re-reading as written after a
reconnect and a power cycle. UDB will check this itself in Phase 6.

## Refused by the allowlist

Everything not in the table above, in particular:
- serial number `00/82` (not needed; it would identify the user's device)
- device mode `00/04` (driver/normal mode), firmware and bootloader commands
- DPI stage table write `04/06` (a wrong length could corrupt stored stages;
  Phase 5)
- lift-off and sensor calibration (class `0B`), button mapping (class `02`),
  lighting (classes `03`, `0F`)
- transaction IDs other than `1F`, `3F`, `FF`; a wrong checksum; non-zero
  bytes 2–4 or 89; values out of range (DPI outside 100–65535, sleep outside
  60–900 s, polling divisors other than the listed rates)

## Open questions (Phase 6)

- Which collection carries the control channel on the `index3` models (Naga X,
  Basilisk V3), where OpenRazer uses USB control index 3?
- Does the Viper Ultimate's stripped-report behaviour affect other receivers?
