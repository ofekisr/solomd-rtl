# 0006. IPC validation: strict in dev, off in production

**Status**: accepted · **Date**: 2026-10-31

## Context

- ADR 0003 validates IPC results with Zod in report mode: dev logs `[platform:drift]` once and returns the raw value; production does not parse; tests run strict.
- Every command catalog has a fixture per command that parses in strict mode (`runCatalogContract`). Drift logs in dev are easy to miss.
- The Wave 1 LLD parked "flip proven domains from report to strict" for Wave 3 with a new ADR.

## Decision

`resolveValidationMode()` returns `strict` in dev and `off` in production. A Rust result that no longer matches its Zod schema throws at the call site in dev. Report mode stays available in `createValidation` for callers that pass it.

## Consequences

- Easier: a Rust change that breaks a TS schema fails the first time a developer runs the path.
- Harder: a dev session can hit a thrown error that production would swallow. Fix the schema or the command; do not catch the error.
- Production behavior is unchanged.
