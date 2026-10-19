# Universal Driver Bus (UDB)

**One bus. Every device.**

A web-based control center for gaming mice, keyboards and headsets. It shows
only the controls a device really supports, and only values the device reads
back. Chrome or Edge, over HTTPS or `localhost` (WebHID).

- What it does and doesn't: `SPEC.md`. Support per device: `SUPPORT.md`
  (generated from `registry/`).
- Adding a device: `CONTRIBUTING.md`. Checks, fixtures and evidence rules:
  `TESTING.md`.
- Security: `THREAT_MODEL.md`. Plan: `ROADMAP.md`. Decisions: `docs/adr/`.

```
npm ci
npm run dev
```

Product images in `public/devices/` belong to their vendors and are not
covered by UDB's licence. Their sources are listed in `registry/images.json`
(ADR 10).
