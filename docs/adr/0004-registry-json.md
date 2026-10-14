# 4. Registry as JSON validated by JSON Schema

Status: accepted, 2026-10-15

## Decision
One JSON file per device model at `registry/devices/<vendor>/<model>.json`,
validated against `registry/schema/device.schema.json` in CI. Evidence sits
inline on each feature's status. The support matrix is generated from the
registry and never edited by hand.

## Rejected
- YAML: needs a parser dependency and has type-coercion surprises.
- TypeScript modules: would make the registry code instead of data.
