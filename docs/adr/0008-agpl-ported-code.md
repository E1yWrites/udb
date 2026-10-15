# 8. Porting code from AGPL-3.0 projects (OpenMouse)

Status: accepted, 2026-10-15. Extends ADR 2.

## Context
OpenMouse (https://github.com/OpenMouse-Project/openmouse, AGPL-3.0 with no
"or later" grant) is a maintained WebHID configurator covering ATK/VXE/VGN,
Logitech, Razer and several Chinese keyboard brands. Porting its code is
faster and less error-prone than re-deriving each protocol. ADR 2 did not
consider AGPL sources.

## Decision
UDB may port code from OpenMouse.
- UDB's own code stays GPL-3.0-or-later.
- Ported files keep their origin: a header naming the source file, the commit
  it came from, and `SPDX-License-Identifier: AGPL-3.0-only`.
- GPLv3 §13 permits combining GPL-3.0 code with AGPL-3.0 code. Once ported
  code ships, **the deployed app as a whole is conveyed under AGPL-3.0
  terms**: anyone using the hosted app must be offered its Corresponding
  Source. The app links to the exact commit it was built from.
- Protocol facts from OpenMouse still need the same evidence as any other
  source before a feature leaves `experimental`.

## Consequences
- Forks that host UDB inherit the AGPL network-source obligation.
- Code from GPL-2.0-only projects stays excluded (ADR 2).
