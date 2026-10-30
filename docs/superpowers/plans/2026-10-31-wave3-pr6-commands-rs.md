# Wave 3 PR-6 — commands.rs → commands/ by domain

> **For agentic workers:** Execute task by task. Steps use `- [ ]`. You never commit and never spawn agents.

**Goal:** `app/src-tauri/src/commands.rs` (1743) → `commands/` module, every file ≤ 600 lines. The 19 Tauri command names and signatures do not change. `cargo check` and `cargo test` green.

**Spec:** LLD S13, S14, §PR-6.

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

**Owns:** `src-tauri/src/commands.rs` → `src-tauri/src/commands/**`; the `generate_handler!` lists in `src-tauri/src/lib.rs` (~182–216, 408–409) and `src-tauri/src/runner.rs` (~768–811); `src-tauri/src/replace.rs` import of `write_file_inner`.

Facts: `src/quick_capture.rs:204–207` documents that `pub use` of a command does not re-export the macro's `__cmd__` item, so handler lists must name `commands::<module>::<name>`. `runner.rs` has a second handler list with the same 19 entries — update both.

---

### Task 1: Module skeleton + moves

- [ ] `git mv src-tauri/src/commands.rs src-tauri/src/commands/mod.rs`, then move code out of `mod.rs` into: `file_io.rs` (read_file + inner, sniff_bom, detect_language, FileReadResult, write_file + inner + extract_tags_for_dispatch, read/write_binary_file, `file_language_tests`), `fs_ops.rs` (copy_file, fs_create_file/dir, fs_delete, fs_dir_exists, fs_file_exists, fs_rename + sibling_assets_dir, is_markdown_path, rewrite_assets_refs), `fs_move.rs` (fs_move + inner, is_self_or_descendant, move_tree, copy_tree), `link_rewrite.rs` (abs_segments … relink_moved_tree, regex fns), `fs_list.rs` (fs_list_dirs/extensions/dirs_with_extensions + inners, filtered_walk, entry_extension), `list_dir.rs` (DirEntry, epoch_ms, entry_times, list_dir_inner, list_dir_with, list_dir, `list_dir_times_tests`), `frontmatter.rs` (BlockLayout … delete_frontmatter_property), `print.rs` (print_webview desktop + mobile).
- [ ] Visibility: items used across sibling modules become `pub(super)`/`pub(crate)`; anything used outside `commands` (`write_file_inner` by `replace.rs`) is re-exported from `mod.rs` with `pub use file_io::write_file_inner;` (plain fns re-export fine). Keep `#[cfg(desktop)]`/`#[cfg(mobile)]` attributes.
- [ ] Tests that reference moved items: `fs_file_exists_distinguishes_files_and_dirs` sits in `list_dir_times_tests` but tests `fs_file_exists` — keep it where it is with a `use super::super::fs_ops::…` or move it; ledger which.
- [ ] Any file > 600 → split further (e.g. `link_rewrite.rs`).

### Task 2: Handler lists

- [ ] `lib.rs` and `runner.rs`: each `commands::<name>` → `commands::<module>::<name>`. Grep the whole `src-tauri/src` for `commands::` (not `git_pane::commands`) to catch other users.
- [ ] `cargo check` (desktop) green; `cargo test commands` + `cargo test --lib` filtered to moved tests green. If the mobile cfg can't be checked locally, ledger it.

## Acceptance

- No file under `commands/` > 600 lines; `cargo check` exit 0; moved tests pass. Report baseline key: `app/src-tauri/src/commands.rs` leaves `fileSize`.
