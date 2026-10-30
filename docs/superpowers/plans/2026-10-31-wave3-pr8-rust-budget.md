# Wave 3 PR-8 — Remaining Rust files to ≤ 600

> **For agentic workers:** Execute task by task. Steps use `- [ ]`. You never commit and never spawn agents. Your dispatch names your worker group; do only that group.

**Goal:** every non-AI `.rs` file in the `fileSize` baseline ends ≤ 600 lines (LLD S15). Behavior and command names unchanged; `cargo check` + `cargo test` for touched modules green.

**Spec:** LLD S13–S15, §PR-8/9/10.

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

## Groups (one worker each; files are the group's ownership)

| Group | Files (lines @09d66a61) |
|---|---|
| A | `git_pane/cli/diff.rs` 1332, `git_pane/cli/git.rs` 1061, `git_pane/cli/refs.rs` 1144, `git_history.rs` 737 |
| B | `github_sync.rs` 1538, `workspace_index.rs` 1426, `capture_endpoint.rs` 1341 |
| C | `runner.rs` 1129, `rest_api.rs` 930, `crypto.rs` 707, `image_upload.rs` 783, `integrations.rs` 734, `convert.rs` 602 |

Shared file rule: `lib.rs` and `runner.rs` handler lists — group C owns `runner.rs`; groups A/B edit only their own lines in `lib.rs`'s `generate_handler!` (re-read before each edit; the controller resolves clashes). Rust workers share the cargo target dir: a concurrent build waits on the lock — that is normal.

Acceptance per group: every owned file (and new submodule) ≤ 600; `cargo check` exit 0; `cargo test <module>` same count as before. Report baseline keys that leave `fileSize` and any renamed paths.
