# Git Pane — Design

- **Date:** 2026-10-20
- **Status:** Approved (brainstorming §1–§4)
- **Target version:** 4.23.0
- **Branch:** `feat/git-pane`
- **Source:** port of [ftuyama/git-light](https://github.com/ftuyama/git-light) (MIT) — Rust backend + pure TS logic kept, Vue UI rewritten

## 1. Goal

A JetBrains-style git client inside SoloMD for the open workspace folder: commit tool window, Git Log dock, diff tabs, branch widget.

### v1 scope

| In | Out (phase 2) |
| --- | --- |
| Status, stage/unstage file + hunk, rollback | Conflict editor (3-pane) |
| Commit, amend, commit-and-push | Interactive rebase |
| Branch list, checkout, new/delete branch | Blame / annotate |
| Commit graph (lanes, refs, search, paging) | Editor-gutter change markers |
| Diff tab: side-by-side + unified, word diff | Stash UI, Shelve |
| Fetch, pull (Update Project), push (+ force-with-lease) | Console tab (git output log) |

### Non-goals

- App Store, Android, web build — pane hidden there.
- Replacing AutoGit (`git_history.rs`) or GitHub sync (`github_sync.rs`); both stay on `git2`.

## 2. Decisions

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| D1 | Repo source | Open workspace folder; root = `git rev-parse --show-toplevel` | One repo, no picker; follows folder switch |
| D2 | Layout | JetBrains mapping (§5) | User request |
| D3 | Engine | System git CLI behind `trait GitEngine`; only `CliEngine` in v1 | Ships via local install / Homebrew cask (unsandboxed); respects `.gitconfig`, hooks, ssh-agent, credential helpers, GPG, LFS; reuses git-light |
| D4 | git2 read path | Deferred; trait leaves room for `Git2Engine` | YAGNI — git-light proves CLI reads are fast enough |

### Agent council (D3)

3/3 members voted hybrid (CLI writes + git2 reads), driven by App Store/Android sandboxing. Overruled since neither target ships. Their shared risks are adopted:

| Risk | Mitigation (in v1) |
| --- | --- |
| `index.lock` race between AutoGit (git2) and pane (CLI) | Per-repo `tokio::Mutex` shared by both (§3 `lock.rs`) |
| GUI-launched app lacks shell `PATH` / `SSH_AUTH_SOCK` (Homebrew git, gpg, git-lfs) | Resolve env once from login shell (§3 `env.rs`) |
| macOS `/usr/bin/git` stub triggers Xcode CLT installer | Probe `xcode-select -p` before invoking |

## 3. Rust backend — `app/src-tauri/src/git_pane/`

| File | Origin | Role |
| --- | --- | --- |
| `mod.rs` | new | Module wiring, `#[cfg(desktop)]` |
| `engine.rs` | new | `trait GitEngine { snapshot, log_page, diff, commit_files, execute(GitAction), cancel }` |
| `cli/git.rs` | git-light `git.rs` | Repo info, snapshot builder |
| `cli/log.rs` | git-light `log.rs` | Commit pages for graph |
| `cli/refs.rs` | git-light `refs.rs` | Branches, tags, status parsing |
| `cli/diff.rs` | git-light `diff.rs` | Diffs, hunks |
| `cli/actions.rs` | git-light `actions.rs`, trimmed (~1.2k of 2667 LOC) | `run_git`, `classify_git_error`, `remote_timeout_for`, `execute_action` subset |
| `env.rs` | new | `$SHELL -lc env` once → cache `PATH`, `SSH_AUTH_SOCK`; locate git; macOS `xcode-select -p` probe |
| `lock.rs` | new | `RepoLocks`: per-repo-root `tokio::Mutex`; also acquired by `git_history.rs` write paths |
| `commands.rs` | new | Tauri commands (below) |

`cli/git.rs`, `log.rs`, `refs.rs` are mutually dependent — ported together. git-light's `watcher.rs`, `repos.rs`, `image.rs`, `app_updater.rs`, journal/undo, rebase editor are **not** ported.

### Actions kept in `execute_action`

stage, unstage, stage-hunk, unstage-hunk, discard (file + hunk), commit (+ amend), checkout (+ force), create-branch, delete-branch, stash-push (for "Stash & checkout" only; no stash UI), fetch, pull, push (+ force-with-lease), init.

### Tauri commands (prefix `gitpane_` — avoids clash with SoloMD's `git_*`)

| Command | Maps to git-light |
| --- | --- |
| `gitpane_version` | `git_version` |
| `gitpane_open` | `git_open_repo` |
| `gitpane_snapshot` | `git_snapshot` |
| `gitpane_commit_page` | `git_commit_page` |
| `gitpane_diff` | `git_get_diff` |
| `gitpane_commit_files` | `git_get_commit_files` |
| `gitpane_execute` | `git_execute_action` |
| `gitpane_cancel` | `git_cancel` |

### Refresh

SoloMD's existing `notify` watcher adds `.git/HEAD`, `.git/index`, `.git/refs/**`; debounce 300 ms → emit `gitpane:changed`.

### Cargo deps to add

`chrono`, `base64`, `uuid` (v4); tokio features `process`, `fs`.

### Tests (`cargo test`)

Temp repos via `git init` in tempdir: status parse, log paging, hunk stage, commit round-trip, lock serialization with AutoGit.

## 4. TS layer — `app/src/lib/git-pane/`

| File | Origin | Role |
| --- | --- | --- |
| `shared/models.ts` | git-light verbatim + MIT header | Wire types |
| `shared/actions.ts` | git-light verbatim | `GitAction` union |
| `shared/errors.ts` | git-light verbatim | `GitError`, classification, credential hints |
| `shared/refLabel.ts` | git-light verbatim | Ref display labels |
| `shared/buildPatch.ts` | git-light verbatim | Patches for hunk staging |
| `graph/computeGraphLayout.ts` | git-light verbatim | Lane / colour layout |
| `diff/wordDiff.ts`, `diff/buildSplitRows.ts` | git-light verbatim | Word diff, side-by-side rows |
| `GitService.ts` | git-light interface | Store dependency contract |
| `tauriGitService.ts` | new (~120 LOC) | `invoke` the 8 commands + `listen('gitpane:changed')` |
| `validate.ts` | new | Hand-rolled type guards on every invoke result (no Zod in SoloMD); bad payload → `GitError('protocol')` |
| `MockGitService.ts` | new | Test double |

### Store — `app/src/stores/gitPane.ts` (Pinia)

- **State:** `repoRoot`, `status: 'idle'|'loading'|'ready'|'no-repo'|'no-git'|'error'`, `snapshot` (branch, upstream ahead/behind, changes), `commits` (paged 200), `selectedCommit`, `included: Set<path>`, `message`, `amend`, `busyOp`, `lastError`.
- **Actions:** `open(folder)`, `refresh()`, `loadMoreCommits()`, `run(action)`, `commit({ push })`, `selectCommit(sha)`, `openDiff(path, side)`.
- **Watchers:** workspace folder → `open()`; `gitpane:changed` → throttled `refresh()`.
- `run()` is the single write path: serialised, refreshes after each write, errors → `toasts` store.

### Diff tabs

New tab language `git-diff`, virtual path `git-diff://<path>?side=staged|worktree|<sha>`, opened through `tabs` store; `PaneContent.vue` renders `GitDiff.vue` (same pattern as mindmap tabs).

### Tests (vitest)

- Port git-light tests for `computeGraphLayout`, `buildPatch`.
- Store vs `MockGitService`: state transitions, commit flow, error mapping.

## 5. UI — `app/src/components/git/`

| Component | Host | Content |
| --- | --- | --- |
| `GitCommitPanel.vue` | `left-stack` beside FileTree, `settings.showGitCommit` | Toolbar (refresh, rollback, fetch); Staged / Changes / Unversioned groups with checkboxes; message box; Amend; **Commit** / **Commit and Push…** |
| `GitChangeRow.vue` | Commit panel | Status letter (M/A/D/R/?/U), name, dir; double-click → diff; context menu: Rollback, Show Diff, Open File |
| `GitBottomDock.vue` | **New** bottom dock under `.content`; resizable, height persisted | Tab bar; v1 tab: **Log** |
| `GitLog.vue` | Dock → Log | 3 columns with splitters |
| `GitBranchTree.vue` | Log left | HEAD, Local, Remote, Tags; double-click checkout; menu: New Branch from Here, Delete, Push, Update |
| `GitGraph.vue` + `GitGraphRow.vue` | Log centre | SVG lanes, subject, ref chips, author, date; `@tanstack/vue-virtual`; infinite paging; search |
| `GitCommitDetails.vue` | Log right | Message, hash, author, changed files → diff at that commit |
| `GitDiff.vue` | Editor tab | Side-by-side default, unified toggle; highlight.js + word diff; worktree hunks get stage/unstage/rollback gutter buttons |
| `GitBranchWidget.vue` | `StatusBar.vue` | `⎇ main ↑2 ↓1`; popup: search, New Branch, Update Project, Push…, Fetch, recent + local branches |
| `GitPushDialog.vue` | Modal | Outgoing commits, force-with-lease checkbox, **Push** |

### Shortcuts

| Key | Action |
| --- | --- |
| ⌘⇧G (`Mod+Shift+G`) | Toggle Commit panel (focuses message box) |
| ⌘9 (`Mod+9`) | Toggle Log dock |
| ⌘↩ (`Mod+Enter`, scope: commit message box) | Commit |
| ⌘⇧U (`Mod+Shift+U`) | Push… |
| ⌘⌥U (`Mod+Alt+U`) | Update Project (pull) |

JetBrains' own ⌘K / ⌘⇧K / ⌘T are taken in `lib/keybindings.ts` (`fmt.link`, `palette.open`, `file.new`); ⌘⌥K is `fmt.codeblock`. The chosen combos are free there. ⌘0 was rejected because it resets the app zoom (`App.vue` zoom handler and the `view.zoomUiReset` menu accelerator). All five are registered as rebindable `git.*` entries in `lib/keybindings.ts` and appear in `CommandPalette`.

### RTL / i18n / styling

- Logical CSS properties only (`inset-inline-*`, `padding-inline`).
- Commit subjects/messages `dir="auto"`; graph SVG and hashes LTR.
- Strings under `git.*` in `i18n` (en, he, ar).
- SoloMD CSS variables + `Icons.vue`; no Tailwind, no reka-ui.

### Empty states

| State | UI |
| --- | --- |
| `no-repo` | "Not a git repository" + **Init** |
| `no-git` | "git not found" + install link |
| No changes | "No changes" |

## 6. Error handling

| Case | Behaviour |
| --- | --- |
| git missing / Xcode stub | `status='no-git'`; `/usr/bin/git` never invoked without `xcode-select -p` success |
| Auth failure | Toast + git-light credential hint (`ssh-add`, credential helper) |
| Merge conflict after pull | Banner "Conflicts in N files" + open-in-editor; full editor is phase 2 |
| Dirty tree blocks checkout | Dialog: Stash & checkout / Force / Cancel |
| Long operation | Per-kind timeout (`remote_timeout_for`); busy indicator with Cancel → `gitpane_cancel` |
| Unknown repo format (SHA-256, reftable) | Handled natively by CLI |
| Every command | Rust `trace.rs`: argv, exit code, duration; tokens never logged |

## 7. Security

- argv arrays only, never a shell string; user-supplied refs/paths after `--`.
- Branch names validated with `git check-ref-format`.
- Paths canonicalised and required to stay inside repo root.
- Commit message via stdin (`git commit -F -`).
- No credential handling in-app — git helpers / ssh-agent only.
- Remote URLs shown with `user:token@` stripped.
- Confirm dialog for rollback, force push, delete branch.
- `/security-review` before merge.

## 8. Rollout

- Branch `feat/git-pane`, bump to **4.23.0**.
- Feature flag `settings.enableGitPane` — default on (desktop); off hides all git UI.
- MIT header kept on every ported file; git-light added to About / credits.

### Phases (one commit each)

| # | Phase | Est. |
| --- | --- | --- |
| 1 | Rust `git_pane` module, 8 commands, `env.rs`, `lock.rs`, cargo tests | ~4 h |
| 2 | Shared TS, pure libs, `tauriGitService`, `validate`, `gitPane` store, vitest | ~2 h |
| 3 | Commit panel + change rows + diff tab with hunk staging | ~4 h |
| 4 | Bottom dock, Log (branches / graph / details), branch widget, push dialog, shortcuts | ~4 h |
| 5 | RTL + i18n pass, empty states, credits, version bump | ~1 h |

### Definition of done

- `cargo test` green; `pnpm --dir app build` green; vitest green.
- Manual check in Tauri on this repo: commit, amend, push, pull, checkout, new branch, hunk stage/unstage, rollback.
- RTL check with Hebrew UI.
- `/security-review` clean.
