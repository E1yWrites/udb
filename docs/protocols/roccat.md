# Protocol family: `roccat` (ROCCAT Kone XTD, Kone Pure, Kone EMP)

Status: **detection only.** UDB recognises three ROCCAT mice (5 product IDs, VID
`1E7D`) and sends them nothing. Unlike the other long-tail families, this
protocol *can* be read back, so it is the best candidate for an adapter once a
device report exists.

## Sources

| Source | What it gave | License | Use |
|---|---|---|---|
| libratbag (commit `8235b5bb`): `src/driver-roccat.c`, `src/driver-roccat-kone-pure.c`, `src/driver-roccat-kone-emp.c`, `data/devices/roccat-*.device` | product IDs, report IDs and sizes, the checksum, the settings layouts | MIT | facts: the registry entries and this note |

libratbag has no other ROCCAT or Turtle Beach device. Newer ROCCAT mice (Kone
Pro, Burst, Kain and others) have no open reference that UDB has found, and
are not listed.

## What libratbag shows

All three drivers use the same feature-report scheme (reports numbered 4 to 8):

| Report | Use |
|---|---|
| `04` | configure: `04 profile type` selects what the next read or write refers to (`80` settings, `90` key mapping). A GET of the same report is a ready poll: byte 1 is `01` when ready, `02` for a second ready state, `03` after which the driver waits 100 ms |
| `05` | current profile: GET answers it in byte 2; SET `05 03 n` switches profile (0 to 4, or 0 to 5 on the Kone EMP) |
| `06` | settings for the selected profile, with a checksum |
| `07` | key mapping for the selected profile, with a checksum |
| `08` | macros, 2082 bytes on the XTD and Pure |

- **Checksum:** the 16-bit little-endian sum of every byte except the last two,
  stored in the last two. libratbag checks it on reads and writes it on every
  settings, key-mapping and macro write.
- **Settings report (`06`):** 43 bytes on the Kone XTD, 31 on the Kone Pure,
  its own struct with lighting fields on the Kone EMP. Common fields: report
  ID, a length or magic byte, profile, X/Y linked, X and Y sensitivity, a DPI
  mask, five X and five Y DPI values (DPI ÷ 50 on the XTD), the current DPI index, and
  the polling-rate index (0 to 3 for 125, 250, 500, 1000 Hz).
- **Limits in libratbag:** DPI 200 to 8200 in steps of 50 (XTD, Pure), 100 to
  12000 (EMP).
- **Read-back:** libratbag reads the settings report after selecting the
  profile, and waits on the ready poll after every write.
- **Read before write:** a DPI write sends the whole settings report back with
  one stage changed, so it must read the report first.

## Why there is no adapter yet

- **The collection is unknown.** libratbag talks to a hidraw node. No device
  report or capture shows which WebHID collection carries reports 4 to 8, or
  whether the browser allows it.
- **No fixtures.** libratbag has layouts but no captured bytes. Tests could be
  derived from the structs, as the Arctis adapter's were, but they would prove
  only that UDB matches libratbag.
- **Old hardware.** The Kone XTD, Pure and EMP are discontinued, and the owner
  has none; checks are deferred to Phase 6.
- **Key mapping and macros** (reports 7 and 8) are larger and riskier and stay
  out of scope.

## What would unblock it

1. A device report (`Copy device report`) from a Kone mouse, to find the
   collection and which of reports 4 to 8 it declares.
2. Then an adapter for DPI stages and polling rate on the Kone XTD, written
   through the write procedure: select profile, wait ready, read, change, write,
   wait ready, read back and compare.
