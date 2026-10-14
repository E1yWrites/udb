# 7. Phase 3 success criteria with owned hardware only

Status: accepted, 2026-10-15

## Context
The brief requires one write-verified device per category. The user owns a
Pulsar X2 CrazyLight (mouse) and a Mechlands Vibe75 (keyboard), and no
supported headset. Nothing will be bought for now.

## Decision
Phase 3 passes when the CrazyLight and the Vibe75 are each write-verified on
at least one setting, including an unplug/replug persistence check. The
headset adapter (`steelseries-arctis`) ships `experimental`, tested only
against replayed traffic. The headset criterion stays an open item in
`ROADMAP.md` until a headset is available. The recommended buy is the Arctis
Nova 7 Gen 2 (`0x227E`), the only Nova 7 with sidetone read-back.

## Consequences
The support matrix shows the headset row as unverified. The brief's
definition of success is not met until a headset is verified.
