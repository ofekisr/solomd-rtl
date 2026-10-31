# Wave 3 PR-9 — Remaining .ts files to ≤ 400

> **For agentic workers:** Execute task by task. Steps use `- [ ]`. You never commit and never spawn agents. Your dispatch names your worker group; do only that group.

**Goal:** every non-AI `.ts` file in the `fileSize` baseline ends ≤ 400 lines (LLD S15), public exports unchanged.

**Spec:** LLD S15, §PR-8/9/10.

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

## Method (every file)

1. Read the file whole; list its responsibilities with line ranges in the ledger.
2. Pure helpers first: move them to a sibling module (`.ts`) / submodule (`.rs`) with a characterization test (TS: node test; Rust: `#[test]` in a sibling `tests.rs`) written **before** the move and green on today's code.
3. Then structural cuts: TS → sibling modules by responsibility, entry file re-exports every public name it exported before (importers unchanged). Vue → child components (explicit typed props/emits), composables (`useX.ts`, called in today's watcher order), style to co-located `.css` via `<style scoped src>` (a child loads the rules for the nodes it renders). Rust → `<file>/mod.rs` + submodules, `pub use` for every item used outside, in-file tests to `tests.rs`; Tauri commands registered in `generate_handler!` lists (`lib.rs`, `runner.rs`) must be named by their new module path (`pub use` does not re-export the `__cmd__` item — `src/quick_capture.rs:204`).
4. A `.ts` in `lib/` stays pure (no `vue`, `pinia`, `@tauri-apps/*`, `platform/`). A new file goes where its parent lives.
5. Run the file's existing tests + your new ones; record line counts before → after.

## Groups

| Group | Files (lines @09d66a61) |
|---|---|
| A | `composables/useFiles.ts` 1042, `composables/useCommands.ts` 818, `composables/useExport.ts` 688 |
| B | `lib/markdown.ts` 1184, `lib/cm-live-render.ts` 1020, `lib/cm-slash-commands.ts` 557, `lib/image-overlay.ts` 608, `features/image-upload/internal/cm-image-paste.ts` 671 |
| C | `lib/docx-export.ts` 764, `lib/pdf-export.ts` 628, `lib/pdf-options.ts` 496, `lib/citations.ts` 421, `dev/pdf-harness.ts` 431 |
| D | `lib/bases.ts` 815, `lib/keybindings.ts` 639, `lib/viewFile.ts` 505, `lib/git-pane/shared/models.ts` 450, `stores/githubSync.ts` 466, `stores/pomodoro.ts` 409, `stores/tabs.ts` 568 |

Notes: `stores/tabs.ts` reads `solomd.settings.v1` directly (lines ~68–90) — leave those reads as they are (PR-11 replaces them). `useFiles.ts`/`useCommands.ts` have dozens of importers: keep the composable's returned object identical. `cm-image-paste.ts` lives in a feature: new siblings go in `features/image-upload/internal/`. `models.ts` may be split into several `*.ts` under `lib/git-pane/shared/` with `models.ts` re-exporting.

Acceptance per group: owned files ≤ 400; their tests + new tests green; `vue-tsc` clean for owned paths.
