# 3. Stack: TypeScript, Vite, Svelte 5, Vitest

Status: accepted, 2026-10-15

## Decision
- TypeScript in strict mode
- Vite for the dev server and build
- Svelte 5 for the UI
- Vitest for unit and integration tests

Adapters, the transport, the capability model and registry tooling are plain
TypeScript with no UI imports.

## Consequences
Contributors who add a device work only in `registry/` and an adapter module.
The UI framework could be replaced without touching protocol code.
