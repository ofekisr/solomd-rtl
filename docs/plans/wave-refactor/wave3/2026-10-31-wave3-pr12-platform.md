# Wave 3 PR-12 — Platform carry-overs

> **For agentic workers:** Execute task by task. Steps use `- [ ]`. You never commit and never spawn agents.

**Goal:** `PlatformUnsupportedError` and `snakeToCamel`/`SnakeToCamel` leave `platform/ipc/command.port.ts` (types only remain); dev validation becomes `strict` (ADR 0006).

**Spec:** LLD S22; ADR 0006; `app/src/platform/CLAUDE.md`.

## Global constraints (all Wave 3 plans)

- No behavior change. Root `CLAUDE.md` invariants hold; `docs/conventions/file-roles.md` names (incl. `.slice.ts`, `.actions.ts`).
- Every file you create or touch ends ≤ 400 lines `.ts`, ≤ 500 `.vue`, ≤ 600 `.rs`. No `any`. Local TS imports end in `.ts`.
- Move with `git mv` (allowed: it is a rename, not a commit) so history follows. No other git writes: never commit, add, stash, checkout, reset.
- Tests: `cd app && node --experimental-transform-types --import ./scripts/node-test-loader.mjs --test <files>`. Arch: `cd app && node --test arch/`. Types: `cd app && pnpm exec vue-tsc --noEmit 2>&1 | grep -E '<your paths>'`. Rust: `cd app/src-tauri && cargo check` / `cargo test <filter>`. Other workers edit other files at the same time: errors outside your owned files are not yours — report them, never touch them.
- Own only the files the LLD §File ownership table gives your PR. Never edit `app/arch/baseline.json`, `app/CLAUDE.md`. When you move a baselined file, tell the controller the old → new key (it renames the key).
- Watchers (Wave 2 lesson): moving logic into composables changes registration order. Call composables in the order the original code registered its watchers. A watcher reacting to an id/path change watches `[id, value]` and skips its work on id change.
- Characterize before moving: any pure helper you extract gets a test against today's behavior first.
- Ledger: append task status and every decision the plan leaves open as `Ruling: <decision> — <reason> — cost if wrong: <x>` to `.superpowers/sdd/2026-10-31-wave3-pr<N>/progress.md`.
- Final report to `.superpowers/sdd/2026-10-31-wave3-pr<N>/report.md`: files changed, moved-file key renames, tests added (count), commands run + exit codes, line counts of every file you created/touched, open issues.

**Owns:** `app/src/platform/ipc/**`, `app/src/platform/index.ts`, `app/src/platform/CLAUDE.md`, and import lines (only) in files importing the two moved symbols.

### Task 1

- [ ] `platform/ipc/platform-error.ts`: `PlatformUnsupportedError` verbatim. `platform/ipc/command-name.ts`: `snakeToCamel`, `SnakeToCamel`, `SNAKE_SEGMENT`. Move their tests (`command.port.test.ts` cases) to `platform-error.test.ts` / `command-name.test.ts`. `command.port.ts` keeps `CommandSpec`, `CommandCatalog`, `CommandPort`, `InvokeFn`, `CommandMethod` and imports `SnakeToCamel` type.
- [ ] Update every importer (`grep -rn "PlatformUnsupportedError\|snakeToCamel" app/src`). `platform/index.ts` keeps `export { PlatformUnsupportedError }` (public surface unchanged).
- [ ] `resolveValidationMode()`: `import.meta.env?.DEV ? 'strict' : 'off'`. Test it (extract `resolveValidationMode(env)` taking `{ DEV?: boolean }` if needed).
- [ ] `platform/CLAUDE.md`: file table + validation modes line updated.

## Acceptance

- `platform/**` tests pass; `vue-tsc` clean for touched files; `command.port.ts` has no runtime exports.
