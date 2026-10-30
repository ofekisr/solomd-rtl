# 0002. Architecture rules as `node --test` specs, not ESLint

**Status**: accepted · **Date**: 2026-10-30

## Context

- The repo has no ESLint. `app/package.json` runs unit tests with `node --test`.
- Wave rules need checks: file size, raw IPC imports, `lib/` purity, feature privacy.
- Some files already break these rules. Wave 0 must not touch runtime code.
- Full design: [Wave 0 LLD](../superpowers/specs/2026-10-30-wave0-guardrails-lld.md).

## Decision

1. Write each rule as a spec in `app/arch/*.arch.test.ts`, run by `node --test`.
2. Record existing violations in `app/arch/baseline.json`. Entries may be removed or lowered, never added or raised.
3. Each failure message starts with `[arch:<rule>]` and says how to fix it.

## Consequences

- Easier: no new dependencies; same runner and speed as the existing unit tests; rules are plain TS.
- Harder: no editor squiggles; import parsing is ours to maintain.
- Must: keep `app/arch/` specs under ~1s total so `guard` stays ≤ 15s.
