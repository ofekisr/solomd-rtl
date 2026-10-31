# Wave 3 PR-10 — Remaining .vue files to ≤ 500

> **For agentic workers:** Execute task by task. Steps use `- [ ]`. You never commit and never spawn agents. Your dispatch names your worker group; do only that group.

**Goal:** every non-AI `.vue` file in the `fileSize` baseline ends ≤ 500 lines (LLD S15). Same props, emits, exposed methods, DOM classes, behavior.

**Spec:** LLD S12 (watcher order), S15, §PR-8/9/10.

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
| A | `components/Preview.vue` 1424, `PaneContent.vue` 526, `PaneTabBar.vue` 724, `Slideshow.vue` 501 |
| B | `components/MindmapCanvas.vue` 1183, `MindmapView.vue` 524, `BasesView.vue` 839, `RelationshipsPanel.vue` 591 |
| C | `components/GithubSyncSettings.vue` 1417, `IntegrationsSettings.vue` 706, `ThemeStudio.vue` 579 |
| D | `components/GlobalSearch.vue` 615, `MarkdownHelp.vue` 671, `CjkProofread.vue` 586 |

Files stay in `components/` (moving them into features is Wave 4 work unless the file already sits in a feature). New children go next to the parent, named `<Parent><Part>.vue`; composables next to them as `use<Parent><Part>.ts` or in `composables/` if shared. Style-only overflow (template + script ≤ 500 but style pushes it over) → co-located `.css` is enough.

Acceptance per group: owned files ≤ 500, new `.ts` ≤ 400; `vue-tsc` clean for owned paths; tests touching them green. Report a 1-line browser check per file (what to click).
