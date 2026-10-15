# 5. No telemetry; a hardened supply chain

Status: accepted, 2026-10-15

## Context
In a browser-only app, the worst case is compromised JavaScript sending
arbitrary reports to every device the user has granted.

## Decision
- No telemetry or crash reporting in v1, not even opt-in. Device dumps reach
  the project only as issues or PRs the user files themselves.
- A strict CSP: `script-src 'self'`, no third-party scripts at runtime, and
  `connect-src 'self'`.
- Few dependencies. Lockfile committed, CI installs with `npm ci`.
- The transport is the only code that calls `sendReport` or
  `sendFeatureReport`, and it checks every report against the adapter's
  allowlist.
- Registry denylist: collections UDB must never open (for example, the G14's
  firmware collection `FF82:00CF`).
