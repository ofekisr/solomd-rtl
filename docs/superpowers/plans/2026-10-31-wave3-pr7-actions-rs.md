# Wave 3 PR-7 — git_pane/cli/actions.rs → actions/ by action group

> **For agentic workers:** Execute task by task. Steps use `- [ ]`. You never commit and never spawn agents.

**Goal:** `app/src-tauri/src/git_pane/cli/actions.rs` (2705) → `git_pane/cli/actions/` module, every file ≤ 600. Public API used by `engine.rs`, `git_pane/commands.rs`, `cli/log.rs`, `cli/diff.rs`, `tests_*.rs` keeps working through `actions::…` paths (re-exports). Behavior identical; `cargo test git_pane` green.

**Spec:** LLD S14, §PR-7.

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

**Owns:** `src-tauri/src/git_pane/cli/actions.rs` → `git_pane/cli/actions/**`; `git_pane/cli/mod.rs`; import lines in `git_pane/engine.rs`, `git_pane/commands.rs`, `git_pane/cli/log.rs`, `git_pane/cli/diff.rs`, `git_pane/tests_*.rs` (only if a path must change — prefer re-exports so they don't).

Map (main@09d66a61): helpers/classify 17–103, run/options/operations 103–363, journal 364–711, rebase bundle 712–854, logging + envelope 855–1026, arg validation 1027–1107, `execute_action` 1108, lfs helpers 1182–1198, `route_action` 1199–2182 (one `match kind`; arm groups: remote 1306–1352, stash 1353–1411, stage/discard/patch 1412–1572, conflicts 1573–1630, commit 1631–1723, checkout/branch 1724–1850, worktree 1851–1873, lfs 1874–1894, merge 1895–1921, rebase 1922–2009, cherry-pick 2010–2024, bisect 2025–2085, reset 2086–2101, revert 2102–2116, tags 2117–2158, refresh/undo/redo 2159–2175, misc 2176–2182), tests 2183–2705.

---

### Task 1: Leaf modules

- [ ] `git mv` to `actions/mod.rs`; carve `classify.rs`, `run.rs`, `journal.rs`, `rebase_bundle.rs`, `envelope.rs`, `args.rs`. `mod.rs` `pub use`s every item previously reachable as `actions::X` from outside (`ActionEnvelope`, `Journal`, `Operations`, `execute_action`, `checked_rev`, `escape_glob`, …) with the same visibility.

### Task 2: Route groups

- [ ] `route_action` stays in `mod.rs` (or `route.rs`) as dispatch: the prelude (lines 1199–1305, the bindings each arm uses) then `match kind` whose arms call one fn per group: `routes_remote.rs`, `routes_stash.rs`, `routes_stage.rs`, `routes_conflicts.rs`, `routes_commit.rs`, `routes_branch.rs` (checkout/branch/worktree/lfs), `routes_history.rs` (merge/rebase/cherry-pick/bisect/reset/revert — split in two if > 600), `routes_tags.rs`, `routes_misc.rs` (refresh/undo/redo/misc). Group fns take a small context struct bundling the prelude's bindings (`RouteCtx<'a>`) — arms' bodies move verbatim, reading `ctx.x` instead of `x`. Unknown-kind fallthrough unchanged.
- [ ] Order of arms within a group unchanged; match on the same string literals.

### Task 3: Tests

- [ ] In-file tests 2183–2705 → `actions/tests/` (`mod.rs` + `classify.rs`, `journal.rs`, `harness.rs` (Harness, init_repo, null_meta), `flows.rs`, `remote.rs`) declared `#[cfg(test)] mod tests;`. Every test name kept. Each file ≤ 600.
- [ ] `cargo test git_pane` green (report pass count before and after — run once before you start for the baseline).

## Acceptance

- No file under `actions/` > 600; `cargo check` + `cargo test git_pane` exit 0 with the same test count. Report baseline key: `app/src-tauri/src/git_pane/cli/actions.rs` leaves `fileSize`.
