# 0003. Platform ports: command catalogs, generic adapters, report-mode Zod

**Status**: accepted · **Date**: 2026-10-30

## Context

- 247 `invoke()` sites call 169 Rust commands from 59 files. 81 files import some `@tauri-apps/*` module (11 modules).
- HLD v3.1 Wave 1: typed, Zod-validated ports per command domain, a tauri and a web adapter each; only `app/src/platform/` imports `@tauri-apps/*`.
- Wave 1 must not change behavior. Unit tests run in Node with no Tauri runtime, so a wrong result schema would only show up in the running app.
- Full design: [Wave 1 LLD](../wave-refactor/2026-10-30-wave1-platform-lld.md).

## Decision

1. **Command catalogs.** Each domain declares its commands once, in `platform/<domain>/<domain>.port.ts`: `{ snake_command: { args?: ZodSchema, result: ZodSchema } }`. The port type is derived from the catalog (method = camelCase command name, args = `z.input`, result = `z.output`). No hand-written method list.
2. **Generic adapters.** `createTauriPort(catalog, invoke)` and `createWebPort(catalog, overrides?)` build every command port. A domain's `<domain>.tauri.adapter.ts` / `<domain>.web.adapter.ts` is a one-line call. Non-command APIs (events, dialog, clipboard, opener, window, path, native fs) get hand-written ports with the same two adapters.
3. **Report-mode validation.** The tauri adapter returns the raw IPC result, never the parsed one. It validates args and result with `safeParse` only when validation is on: `report` in dev builds (log `[platform:drift]`), `off` in production, `strict` (throw) in unit tests.
4. **Errors pass through.** The tauri adapter never wraps or rethrows IPC errors; callers see what `invoke` rejected with. The web adapter rejects (async) or throws (sync) `PlatformUnsupportedError` wherever today's web build fails.
5. **Selection.** `platform/index.ts` picks the adapter once with `isTauri()` and exports one instance per port. Callers import ports from `platform/index.ts` only.

## Consequences

- Easier: one place per domain to read the Rust surface from TS; adding a command is one catalog entry; contract tests run every catalog against both adapters.
- Harder: result schemas can drift from Rust silently in production. Dev builds log drift; Wave 3 flips proven domains to `strict`.
- Must: keep each `.port.ts` ≤ 400 lines (split a domain rather than grow a port); never return parsed data from an adapter until a domain is flipped to `strict` by a later ADR.
