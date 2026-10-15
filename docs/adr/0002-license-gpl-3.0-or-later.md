# 2. License: GPL-3.0-or-later

Status: accepted, 2026-10-15. Extended by ADR 8 (AGPL-3.0 sources).

## Context
The best open protocol sources, as checked on 2026-10-15:
- HeadsetControl: GPL-3.0
- VIA: GPL-3.0
- OpenRGB: per-file `SPDX-License-Identifier: GPL-2.0-or-later`; the
  repository LICENSE is the GPL-2.0 text
- Solaar, QMK: "version 2 … or (at your option) any later version"
- Vial, OpenRazer: GPL-2.0-or-later
- ckb-next: GPL-2.0 license text, with no per-file "or later" grant
- libratbag: MIT
- rivalcfg: WTFPL

## Decision
UDB is GPL-3.0-or-later. Code may be ported from GPL-3.0, GPL-2.0-or-later
and permissive sources, keeping each source's copyright notice. Projects that
are GPL-2.0-only, or whose terms are unclear (currently ckb-next), are
protocol references only: facts, never code. Vendor apps are references only,
and their code is never copied.

## Consequences
Each adapter's protocol doc names its sources and licenses. Porting from a
source not covered above requires checking its license again.
