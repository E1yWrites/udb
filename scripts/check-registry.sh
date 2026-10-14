#!/usr/bin/env bash
# Validate every registry entry, and prove the schema rejects the known-bad
# fixtures (write-verified without hardware or read-back, companion features
# shown as device controls). Phase 2 moves this into Vitest.
set -euo pipefail
cd "$(dirname "$0")/.."
ajv() { npx -y -p ajv-cli@5.0.0 -p ajv-formats@3.0.1 ajv validate --spec=draft2020 -c ajv-formats \
  -s registry/schema/device.schema.json "$@" 2>&1 | grep -v '^npm warn'; }

ajv -d 'registry/devices/**/*.json'

for f in registry/schema/invalid/*.json; do
  if ajv -d "$f" >/dev/null; then echo "FAIL: schema accepted $f"; exit 1; fi
  echo "$f rejected (expected)"
done
