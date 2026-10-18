# Security review, Phase 6 (2026-10-18)

Reviewed `main` at 92c6af9 against `THREAT_MODEL.md`. Checked by reading the code and the built `dist/`, not by attack testing.

| Threat | Result | Evidence |
|---|---|---|
| T1 | Partly open | Actions pinned by SHA, `npm ci`, lockfile, `npm audit` reports 0 vulnerabilities. **Branch protection is still off**: the repo is private on a free plan, so GitHub refuses it (HTTP 403). Owner action. |
| T2, T5 | Holds | Only `src/lib/transport.ts` calls the send/receive functions (`tests/guards.test.ts`); it checks the declared report, the deny list and the adapter allowlist on every report. |
| T6 | Holds | No `fetch`, XHR, WebSocket or beacon in `src`; CSP `connect-src 'self'`. The only storage is `localStorage` for profiles. |
| T7 | Holds, doc corrected | "My device isn't listed" requests with no filter. Such a device has no adapter, so no allowlist and nothing is sent. The threat model now says so. |
| T8 | Holds | No `{@html}`, `innerHTML` or `eval` in `src`; a test fails if `{@html}` appears. |
| T10, CSP | Holds | `dist/index.html` carries the CSP; its one script is same-origin and none are inline. |
| T12 | Holds | Service worker per ADR 9, tested against a fake scope. |
| T13, T14 | Holds | Covered by `tests/profiles.test.ts` and the VIA definition and keymap tests. Not fuzzed. |
| Dev code | Holds | `src/dev/preview.ts` loads only under `import.meta.env.DEV`; it is absent from `dist/`. |

Fixed in `THREAT_MODEL.md`: the T14 row sat below the "Actions for the owner" section, outside the table; T7 now describes the unfiltered chooser.

Not covered: hardware behaviour. T3, T4 and T9 need the Phase 6 device pass.

Owner actions: turn on branch protection for `main` (needs a public repo or GitHub Pro), and confirm 2FA.
