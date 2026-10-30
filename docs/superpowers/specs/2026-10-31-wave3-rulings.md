# Wave 3 — rulings ledger

Every `Ruling:` line from the Wave 3 SDD ledgers (decisions taken without the user). Design rulings S1–S26 are in the [LLD](2026-10-31-wave3-settings-shell-lld.md#rulings).

141 rulings.

| PR | Ruling | Why | Cost if wrong |
|---|---|---|---|
| PR1 | one Sonnet implementer per PR runs its tasks in order; one Sonnet review per PR over the uncommitted diff; controller commits per seam after verify | user contract "workers never commit" replaces per-task commits | a bad task is caught one PR later, not one task later. |
| PR1 | push to origin at start denied by permission; continue locally, push at close | cost if wrong: origin lags 19+ commits until close. |  |
| PR1 | PR-6 and PR-7 run in one Rust worker, sequentially | a half-split crate breaks the other worker's cargo check | ~20 min wall clock. |
| PR1 | batch B (PR-3,4,5,6,7,12) starts before PR-1 lands; only PR-2 consumes PR-1 code | cost if wrong: none, files are disjoint. |  |
| PR1 | controller commits always pass explicit pathspecs (git commit -- <paths>) | 22fa8b5d swept a worker's staged git mv/git rm; history rewrite was denied, so forward-fixed in 0d2447b4 | one more forward-fix commit. |
| PR1 | golden hadStored asserted in the golden test (none case runs first in file; sticky flag stays false until a blob case loads) | works, no need to drop | test order dependence, documented in features/settings/CLAUDE.md. |
| PR1 | lens keybinding migration stays out of SETTINGS_MIGRATIONS (belongs to keybindings slice normalize in PR-2) | it reads the sanitized keybindings map and runs every load today, idempotent | PR-2 must place it right after the keybindings sanitize; golden legacy-keybindings case catches it. |
| PR1 | zh→en is in step 1→2 per plan, though today it runs on every load | a v2 blob containing zh (only via older-build downgrade write) would no longer be fixed | rare language fallback; fix by moving to language normalize in PR-2. |
| PR1 | migration steps read/write raw (pre-merge); editor font default 14 and preview default 15 are constants in settings-migrations.ts because up() has no defaults access; `??` kept for previewFontSize to match today's null handling | cost if wrong: golden v4-beta/v36 cases catch it. |  |
| PR1 | baseline schema `featurePurity` uses .default([]) so baseline.json (which controller edits) still parses before the key exists | cost if wrong: a missing key reads as no violators; the arch test still fails on any violator. |  |
| PR1 | defaults path (null/bad JSON) also carries settingsVersion: 2 | fresh installs are already v2 | PR-2 golden 'none' expected needs settingsVersion; trivial. |
| PR1 | valid JSON that is not an object (null, number, array) returns defaults with hadStored true, mirroring today's flag being set before the throw | cost if wrong: none observable. |  |
| PR1 | pinned navigator (en-US, Macintosh UA, 0 touch points) in withLocalStorage so defaults() language/isMobile are machine-independent | cost if wrong: none. |  |
| PR1 | golden-capture helper named useGoldenCapture.ts because it imports pinia and feature-purity forbids that elsewhere | cost if wrong: rename. |  |
| PR1 | feature-purity ignores type-only imports (`import type`, and `import { type A, type B }` with no default/value specifier; `export type ... from`) | purity is about runtime deps | a type import could hide a coupling; none at runtime. Detected via TypeScript AST in the rule (scan.ts's preProcessFile cannot distinguish). |
| PR1 | capture script takes optional case names so a single expected file can be generated without touching others | cost if wrong: none. |  |
| PR2 | key placement | `showFileTree`+`fileTreeWidth` explorer (LLD table); `showAgentPanel`+`agentWizardSeen` ai (Settings -> AI page shows both; LLD lists `showAgentPanel` under ai); `showHistoryPanel`, `enableGitPane`, `showGitCommit`, `showGitLog`, `gitDockHeight` git; `showBacklinks/Relationships/TagsPanel/TasksPanel/Neighborhood/TypesPanel/Inspector`, `sideSidebarWidth`, `rightSidebarPaneHeights`, `rsPaneOrder`, `_rsPanesBeforeHide`, `showViewsPanel`, outline*, `formatHints*`, `toolbarHidden` layout; `livePreview`, `foldingEnabled`, `solidCursor`, `alwaysShowMarkers`, `highlightCurrentLine`, `limitEditorWidth` general (editor display); `distinctSplitPanes`, `codeBlockLineNumbers`, `codeBlockWrap`, `previewFontSize`, `readingByDefaultOnMobile` preview; `aiReleaseDelayMs`, `aiStaleTimeoutMs`, `aiWarningAlwaysMinimized` ai (ai* prefix, though the Settings UI places them near auto-save); `autoSaveDelayMs`, `convertConflictChoice` app; five one-time markers app; `workspaceBibliography/Csl`, `ragEnabled`, `quickCapture*` integrations; `imageExportBranding` export; `spellcheck*`, `showWritingStats`, `showWorkspaceDailyTotal`, `windowsEditorEngine` writing — LLD table + "slice whose Settings page shows it" | moving a key is a file move + test, no behavior change |
| PR2 | slice types are `type` aliases, not `interface` | `SettingsSlice<S extends Record<string, unknown>>` rejects interfaces (no implicit index signature) | none (same shape) |
| PR2 | store imports through `contracts/` via new `contracts/settings-store.contract.ts` (+ one export block in `contracts/index.ts`) | arch `feature-boundary` forbids `stores/` reaching `features/settings/internal/` and has no baseline escape | re-point 1 import |
| PR2 | `SETTINGS_SLICES` wraps each slice in `asRecordSlice` (single `as unknown as SettingsSlice`) | `SettingsSlice<S>.schema` is invariant in S, so a heterogeneous array needs one widening cast | none |
| PR2 | normalize order across slices is irrelevant (disjoint keys, no cross-key reads); registry order = LLD table order; golden test green | cost if wrong: reorder one list |  |
| PR2 | lens keybinding migration lives in `app.slice` normalize right after the sanitize loop (per PR-1 review) | cost if wrong: none (golden `legacy-keybindings` pins it) |  |
| PR2 | `right-sidebar-shell` module state moved to `internal/actions/right-sidebar-shell.ts` (getter `getRightSidebarShell`); `toggleRightSidebar` reads it once at the top; `setRightSidebarShell` re-exported from the store | needed so actions need not import the store | none |
| PR2 | action count is 162 (+ `persist` in the store = 163), not the plan's "170" | counted from source; script asserted every action is assigned exactly once | none |
| PR2 | `setImageUpload` and `persist` lost their `any` casts (typed via `Record<string, unknown>`) | no-`any` constraint | none (same runtime) |
| PR2 | `settingsVersion` added by hand (python, sorted top-level) to all 10 `expected/*.json`; golden exclusion removed | per PR-1 review decision | re-add exclusion |
| PR2 | 6 tests in other features regex-matched `stores/settings.ts` source for default keys (vim, spellcheck, completion, ai-rewrite, folds, image-upload); they now assert `key in defaults()` (S19 later types this) | the source no longer holds the keys | none |
| PR2 | dev drift reporter `console.warn` gated on `import.meta.env?.DEV` (optional chaining so plain node tests do not throw) | cost if wrong: none |  |
| PR2 | `defaults()` export kept in the store as merge of slice defaults; its error path (`localStorage` throws) falls back to it as `load()` did | cost if wrong: none |  |
| PR3 | pages call composables/stores directly, so page-local state (font custom mode, key filter, spell dict list, directive status) initializes each time the modal opens (DsModal renders slot with v-if) instead of once at app start | plan says "a page imports the composables it uses" | stale-vs-fresh state difference only (e.g. Custom font mode re-derived from current fontFamily on reopen) |
| PR3 | panel-only wiring split in three calls in original watcher order: useSettingsNavigation (scroll watch, deep-link watch) → useSettingsSearch (visibility watchEffect, search watch) → useSearchShortcuts (open watch + key listener) | original registration order; openPage lives in useSettingsNavigation and takes the shared searchQuery ref | one-tick ordering of watchers |
| PR3 | extra pure files font-presets.ts, pdf-mm-range.ts, settings-env.ts(useSettingsEnv), useChordHint.ts, settings-panel-context.ts added beside plan's list | pure helpers need node tests without pulling pinia/ports; env flags and withChord are used by several pages | none (file names) |
| PR3 | `.settings__body[data-searching] > [data-cat]:not(...)` becomes `> :deep(...)` in panel css | page roots are fragment nodes and get no panel scope attribute | search mode would show non-matching blocks |
| PR3 | context file is internal/useSettingsPanelContext.ts (not settings-panel-context.ts) and the page list is ui/settings-pages.ts (not internal/settings-pages.ts) | controller note: feature-purity rule allows runtime vue only in ui/, use*.ts, *.store.ts | file names only |
| PR3 | DOM-order check | applySearch sets style.order = pageIndex*2+1 per block, visibility keyed on data-page via generated CSS, ties keep DOM order = source order within page, so grouping by page changes nothing visible | search result order within a page |
| PR3 | template test BLOCK_OPEN indent changed from ` {8,}` to ` {2,}` (pages indent blocks 2 spaces) | cost if wrong: none |  |
| PR3 | page-local state re-initializing on each modal open accepted | only transient UI state (key filter, custom-font mode, inline mm error) and one extra spellcheckListDicts IPC per open; no persisted input lost | hoist into panel provide(). |
| PR4 | FTREE_EDIT, FtreeEditApi, indentGuides live in internal/tree-render.ts (not ui/FileTreeNode.ts) | avoids internal importing ui | move 3 symbols |
| PR4 | AppLayout imports FileTree via contracts/file-tree-component.ts (editor precedent) | keeps contracts the only public path | one import line |
| PR4 | renamed internal/createFileTreeState.ts -> useFileTreeState.ts and tree-render.ts -> useTreeRender.ts | feature-purity arch rule allows vue only in ui/, use*.ts, *.store.ts; controller note | rename |
| PR4 | added useTreeContextActions.ts (ctx menu open/close + copy/open-side/workbench/reveal actions) and useTreeWindowKeys.ts, tree-repoint.ts, tree-types.ts beyond plan list | plan's chunk list left lines 110-200 and 169-200 unassigned | file renames |
| PR4 | CSS split into 5 sheets (root, header, switcher, menu, dialog), each loaded by its component via <style scoped src>; :deep rules for FileTreeNode rows stay in root sheet | scoped CSS does not cross components | a visual regression in a child |
| PR4 | FileTreeHeader/Menu/Delete emit events instead of calling settings store actions | children render+emit only | none |
| PR4 | reorderFor/destinationFor pure helpers take DOM probes (RowProbe/DestinationProbe); DOM reads stay in useTreeDragDrop | separable math, tested | none |
| PR5 | added useToolbarTips.ts + useToolbarDoc.ts (shared tip/chord, isMarkdown) | tip() used by every child | one tiny file to inline. |
| PR5 | children register onUpdated via useMeasureOnUpdate (inject TOOLBAR_MEASURE) | root onUpdated no longer sees child-only re-renders, overflow must still re-measure on content change | ⋯ button stale on locale/tab-kind change. |
| PR5 | useWindowsCaption called in root (not WindowsCaption.vue) and shared via WINDOWS_CAPTION inject | keeps mount hook order overflow→win→doc listeners | none functional. |
| PR5 | sidebar/view-cycle group (orig 876–906) stays in root; plan assigned it to no child | cost if wrong: root +30 lines. |  |
| PR5 | CSS split into toolbar.css (root), toolbar-controls.css, toolbar-dropdown.css, menubar.css, win-controls.css, each loaded via <style scoped src> by renderers | cost if wrong: a rule missing in a child (check browser). |  |
| PR5 | v-if moved from child root to usage in parent (isMarkdown/hasViewButtons/winTitleBar) so each child has a single element root | cost if wrong: none. |  |
| PR6 | runner.rs `#[path = "commands.rs"]` -> `#[path = "commands/mod.rs"]` | runner mounts commands as a nested module, so file path had to follow | bin fails to build (it builds). |
| PR6 | moved code uses `super::super::watcher`/`recipe_runner` (not `crate::`) | commands is root-level in lib but nested under runner in the bin | bin or lib build error. |
| PR6 | `fs_file_exists_distinguishes_files_and_dirs` stays in list_dir::list_dir_times_tests, imports `super::super::fs_ops::fs_file_exists` | minimal move, name kept | none. |
| PR6 | mod.rs re-exports every plain pub (non-command) item with `#[allow(unused_imports)]` | tests/*.rs use `app_lib::commands::{read_file_inner, fs_move_inner, ...}`; plan only named write_file_inner | integration tests fail to compile. |
| PR6 | submodules declared `pub mod` | generate_handler! needs `commands::<mod>::<name>` reachable from lib.rs/runner.rs (S13) | build error. |
| PR6 | `list_dir_inner` dead-code warning in bin only; pre-existing (no caller anywhere) | cost if wrong: warning only. |  |
| PR7 | RouteCtx + no_target live in new `route_ctx.rs` | keeps mod.rs dispatch-only; closures run/run_input/run_allow/run_stream became ctx methods, each routes_* fn re-binds them as same-named closures so arm bodies are verbatim | none (behavior identical). |
| PR7 | group fns return `Result` and end in `_ => Unsupported action` (same message); mod.rs match lists each arm's literals and dispatches to group | unknown kind falls to same message | a kind listed in dispatch but missing in group yields Unsupported (arm lists were generated from the source). |
| PR7 | history group is one file (239 lines) | under 600 | none. |
| PR7 | private items in leaf modules became `pub(super)`; `pub use` globs for args/envelope/journal/run, and `#[allow(unused_imports)] pub use` for classify/rebase_bundle (no outside user) | preserves `actions::X` paths | warning/visibility only. |
| PR7 | extract_conflict_files/lfs helpers in classify.rs; checkout_*/escape_glob/todo_line/meta_*/checked_* in args.rs; format/truncate/record_result in envelope.rs | per LLD map | none. |
| PR7 | route_action is `pub(super)` (commit-and-push arm recurses into it). |  |  |
| PR7 | tests dedented to rustfmt-style, use `super::super::*`; harness items pub(super) | cost if wrong: none. |  |
| PR7 | `git rm --cached` run on temp filename of old file after `git mv` (index now shows D for old paths, new files untracked) | avoid leaving temp name tracked | controller `git add` of the new dirs fixes it. |
| PR8 | PR-9 groups B, C and PR-10 groups A, B start during batch B | their files are disjoint from batch B ownership | a merge fix pass. |
| PR8 A | git_history stays a file module with #[path = "git_history/x.rs"] children | runner.rs loads it via #[path = "git_history.rs"], plain `mod x;` would resolve to src/x.rs | runner.rs edit (group C owns) |
| PR8 A | 7 #[tauri::command] wrappers stay in git_history.rs | lib.rs/runner.rs handler lists and super::recipe_runner unchanged | handler path edits in two files |
| PR8 A | tests moved verbatim to tests.rs, no new helpers extracted so no new characterization tests | pure file cut | none |
| PR8 A | #[allow(unused_imports)] on diff `pub use search::*` and git `proc::{git_bytes,..}` re-exports | items were pub, now only used by tests | a lint warning |
| PR8 | rsync'd main's app/src-tauri/src into the worktree | needed to build against current runner.rs/lib.rs | worktree diff includes main's PR-6/7 Rust changes (identical to main); merge them away. |
| PR8 | handler list names menu::/window::/language:: paths | pub use does not re-export __cmd__ | command not found at runtime (cargo check would fail first). |
| PR8 | RunEvent closure extracted to events::handle_run_event(&AppHandle, RunEvent) | no behavior change, only dedent | none. |
| PR8 | runner.rs #[path] for the 5 moved files now point at <name>/mod.rs | required by dir conversion | build fails. |
| PR8 | no new characterization tests | extractions are verbatim moves of already-tested code; test count unchanged (lib 370, bin 380) | a moved untested helper regresses unnoticed. |
| PR8 | worktree base stale (dcb2ad77, no commands/ split); `git merge --ff-only main` was denied, so proceeded on stale base | my 3 files are identical on main, lib.rs/runner.rs edits touch only handler/#[path] lines | trivial textual conflict on those lines. |
| PR8 | submodule items pub(super) + private `use x::*` globs in mod.rs; `pub use push::*/pull::*` (github_sync), `pub use commands::*/note::*/test_hooks::*` (capture_endpoint) keep app_lib::<mod>::* API for tests/*.rs and quick_capture | cost if wrong: integration tests fail to compile. |  |
| PR8 | sibling refs `super::crypto\|watcher\|git_history\|portable` become `super::super::...` | runner.rs mounts these modules inside the bin's runner mod | bin build breaks (cargo check --all-targets exit 0 confirms). |
| PR8 | in-file test mods moved to tests.rs / tests_tasks.rs; test paths change (names only), no new helpers so no new characterization tests | cost if wrong: none. |  |
| PR8 C | security review flagged rest_api token generation (time+pid LCG, not a CSPRNG) | pre-existing at 6a74f473~1, moved verbatim; not fixed in a no-behavior-change wave | guessable REST API token until a dedicated fix (proposed as a separate task). |
| PR8 B | security review flagged capture_endpoint token generation (same time+pid LCG as rest_api) | pre-existing at 394a316c~1, moved verbatim; not fixed in a no-behavior-change wave | guessable capture token until the dedicated fix. |
| PR9 | PR-9 groups B, C and PR-10 groups A, B start during batch B | their files are disjoint from batch B ownership | a merge fix pass. |
| PR9 C | docx-export.ts imports only each sibling's names; public export markdownToDocxBlob unchanged | importers untouched | none. |
| PR9 C | pdf-export re-exports buildHtml2PdfOptions (moved to pdf-html2pdf-options.ts); pdf-options re-exports parsePdfFrontMatter/buildPrintStyle/buildWindowsPrintFrameStyle/withPdfToc | keeps importers (harness, print-harness) unchanged | none. |
| PR9 C | deduped two identical quoteFontFamily copies into pdf-font.ts | bodies were byte-identical | none. |
| PR9 C | replaced `any` in toRunOpts (docx-runs.ts) with IRunOptions and in buildHtml2PdfOptions with new Html2PdfOptions interface | touched files must have no any | a type mismatch, vue-tsc is clean. |
| PR9 C | new sibling imports use .ts extension (docx-*, pdf-*, citations-bibtex); original extensionless imports in untouched lines kept | cost if wrong: none. |  |
| PR9 C | no moved key in baseline for group C except sizes; controller should lower/remove fileSize entries for the 5 files (all now <=400) | cost if wrong: tight check fails. |  |
| PR9 B | characterize via golden JSON snapshots generated from pre-move code (temp `export` on private fns, removed/kept as noted) | functions were private and DOM/CM-heavy; hand-written expectations would risk encoding my reading, not behavior | a golden captured an existing bug (intended: no behavior change). |
| PR9 B | cm-live-render buildDecorations now exported from cm-live-decorations.ts (needed by test); slashStateField exported from cm-slash-commands.ts (test) | additive exports only | two extra internal exports. |
| PR9 B | tests call ensureSyntaxTree before decorating | syntaxTree() returns a partial tree under load (full-suite run flaked once) | none. |
| PR9 B | image-overlay-fit.test.ts uses hand-computed expectations (pure arithmetic copied from fitToScreen), not a golden | cost if wrong: formula transcription error; reviewed against orig. |  |
| PR9 B | no file moved; baseline fileSize keys for the 5 group-B files can be deleted by the controller | cost if wrong: tight check fails until removed. |  |
| PR9 D | bases.ts / keybindings.ts / viewFile.ts re-export exactly the previous public names (explicit lists where a sibling exports extra helpers) | importers untouched | a missing export, vue-tsc clean. |
| PR9 D | models.ts is `export *` from models-repo/diff/search (pure types) | cost if wrong: none. |  |
| PR9 D | pomodoro/tabs pure parts characterized after the move (importing the stores in node fails on import.meta.glob); bodies moved verbatim | cost if wrong: a subtle persist change, tests cover stale/round-trip. |  |
| PR9 D | tabs.ts: loadPersisted takes isTabDirty callback (isDirty needs useThemeStudio, stays in tabs.ts); settings.v1 reads moved verbatim into tabs-persist.ts, still direct (PR-11) | cost if wrong: PR-11 must edit tabs-persist.ts instead of tabs.ts. |  |
| PR9 D | replaced `(window as any)` in tabs-persist and `(this as any).remainingMs` in pomodoro with typed forms | touched files must have no any | none, vue-tsc clean. |
| PR9 D | extracted mergeTabsDedup and fileNameFromSavedPath from tabs.ts (needed to get under 400) | pure, tested | none. |
| PR9 D | no baseline key renames (no baselined file moved); controller should lower/remove fileSize entries for the 7 files | cost if wrong: tight check fails. |  |
| PR9 B | minor-only fix rounds (PR-9 B duplicate appendChild, golden extension) are closed by the isolated verify instead of a scoped re-review | the fix touches one line plus a golden captured from HEAD | a one-line regression caught by final review. |
| PR9 A | split by factory modules `createX(ctx, deps)` sharing one FilesCtx, openPath late-bound through a thunk | breaks the openPath<->openXmind/importDocuments cycle without changing closures | one extra indirection call per openPath. |
| PR9 A | useFiles has no watchers/listeners; inject() and use*Store() calls keep original order (tabs, convertedOutput, workspace, settings, toasts, recentEdits, windows, i18n, inject) | nothing to reorder | none. |
| PR9 A | moved constant Sets (CONVERT_*, IMAGE_EXTENSIONS, TEXT_LINK_EXTENSIONS) from per-call closures to module consts | never mutated | none. |
| PR9 A | characterization tests were written against the extracted pure helpers (file-names, share-url, strip-markdown) rather than before the move | the originals were closures inside composables that import stores/Tauri and cannot load under node:test; bodies were moved verbatim by line slice | a transcription slip in a helper (tests + vue-tsc cover it). |
| PR9 A | replaced `window as any` in getUnsavedDialog with a typed cast | repo rule "no any" | none. |
| PR9 A | `Command` re-exported from useCommands.ts via `export type` | importers unchanged | none. |
| PR9 A | developerCommands now built only when pushed (was built eagerly, discarded) | pure closures, no side effects | none. |
| PR10 | PR-9 groups B, C and PR-10 groups A, B start during batch B | their files are disjoint from batch B ownership | a merge fix pass. |
| PR10 D | style-only cut for GlobalSearch/CjkProofread | script+template already ≤500, plan allows co-located .css | none (reversible) |
| PR10 D | markdown-help-items.ts is a plain-named data module in components/ (no role suffix fits pure data) | plan says new files sit next to parent | one rename |
| PR10 A | mermaidIdSeq stays module-level in usePreviewBlocks.ts | it was module-level in the SFC; per-instance would collide ids across panes | duplicate mmd- ids |
| PR10 A | Preview watcher order kept (theme x2 inside usePreviewBlocks, then html, then plantuml); 3 duplicated render passes folded into renderPostPass | same call sequence | diagram render order |
| PR10 A | characterization tests for pure helpers written after verbatim extraction (code unchanged) | cost if wrong: none expected |  |
| PR10 A | browser check not run | Browser pane navigate timed out | unverified UI |
| PR10 B | styles to co-located .css via `<style scoped src>` for Canvas/Bases/Relationships/View | plan-sanctioned, zero behavior change | scoped-attr mismatch in children (none created render nodes, so low) |
| PR10 B | MindmapCanvas split into 9 `useMindmapCanvas<Part>.ts` factories in components/ (Viewport, Focus, Gates, Duplicates, TreeEdit, History, Clipboard, Style, Menu); no watchers moved | all 3 watchers + mount hooks stay in the .vue in original order | a watcher-order regression (none possible: composables register none) |
| PR10 B | no new unit tests for the Mindmap composables | they are closure glue over a live mind-elixir instance (DOM), pure logic already in lib/ with tests | regressions only caught in browser |
| PR10 B | BasesView filter helpers extracted to basesFilterValues.ts (+4 tests) and useBasesFilters.ts | needed to reach <=500 | low, pure |
| PR10 B | MindmapView runViewAction toggles → VIEW_TOGGLES table (-7 lines) | same behavior | none |
| PR10 C | GithubSyncSettings.css loaded by parent + 4 children via `<style scoped src>` | scoped needs per-component attrs; unscoped would leak ghs-* | duplicate CSS bytes (~340 lines x5). |
| PR10 C | child-local form state (token inputs, upgrade form, commitMsg, gitea repo form) resets when the state card unmounts (originally persisted in parent) | splitting by state card; only unsaved typed text affected | lost draft text on provider switch. |
| PR10 C | kept watch/onMounted/initGiteaState in parent in original order (onMounted, watch folder, watch provider); children have no watchers | cost if wrong: none. |  |
| PR10 C | Gitea clone-link passes parent `link` as prop fn so input clears after link completes, as before | cost if wrong: none. |  |
| PR10 A | mermaidIdSeq and previewFoldsByDoc are PER-INSTANCE (inside the composable functions) | original <script setup> top-level lets were per-instance; my earlier module-level ruling was wrong | shared fold/id state across previews |
| PR10 C | single reactive drafts prop instead of per-field defineModel | fewer props, same ownership | nested prop mutation style. |
| PR10 C | one shared reactive drafts prop instead of ~26 defineModel fields | restores HEAD ownership with less prop surface | nested prop mutation style flagged in a later lint. |
| PR11 | ordered SETTINGS_SLICES list stays in features/settings/internal/settings-slices.ts; shell/settings-registry.service.ts re-exports it | a configureSettingsSlices() setter would leave the store with no slices in the 141 importers that run without main.ts (tests) and change load timing | list is one import away from moving to shell later. |
| PR11 | SETTINGS_PAGES lives in shell/settings-pages.ts (no role suffix) | it imports .vue pages; page components reach shell through contracts/settings-pages.contract.ts re-exports; panel gets the list via inject(SETTINGS_PAGES_KEY) | low. |
| PR11 | App.vue provides EDITOR_REGISTRY_FACTORY and SETTINGS_PAGES_KEY before createRightSidebar() | provide is keyed, no watcher registered, so Wave 2 order lesson unaffected | none. |
| PR11 | I18nKey = leaf paths \| `group.*` (completion feature uses 'slashCommands.labels.*'); type-level recursion worked, no generated union | cost if wrong: tsc depth errors (none seen). |  |
| PR11 | per-feature manifest asserts + resolveKey deleted (image-upload, folds, vim, spellcheck, ai-rewrite, completion i18n, format, editor manifest); coverage moved to shell/settings-registry.service.test.ts | cost if wrong: none, strictly stronger. |  |
| PR11 | removed 'SETTINGS_PAGES keys equal ALL_PAGE_KEYS' from lib/settings-nav.template.test.ts (duplicate; lib test must not import shell) | moved to registry test. |  |
| PR11 | testkit not exported from contracts/index.ts; importers use contracts/testkit.ts directly. |  |  |
| PR11 | SETTINGS_SLICES stays in features/settings/internal/settings-slices.ts, re-exported by shell/settings-registry.service.ts (registry test lives there) | the store is created by 141 importers without main.ts, a setter would leave it slice-less | one import move. |
| PR12 | resolveValidationMode(env) lives in ipc/validation.service.ts, index.ts passes import.meta.env | testable without Vite env | trivial move. |
| PR12 | used `git rm -f` on command.port.test.ts (staged deletion) since tests were moved | rename-equivalent | `git restore --staged` the deletion. |
| PR12 | all importers were inside platform/; no non-platform file imports the moved symbols. |  |  |
| FINAL | normalize receives the MIGRATED record (final review I1) | supersedes the PR-1 round-1 choice of pre-migration parsed; output identical today (migration-owned and normalized keys do not overlap, golden proves it) and a future migration of a normalized key is no longer undone | a future normalizer that needs the raw pre-migration value must read it explicitly. |
| FINAL | zh→en becomes an idempotent normalize in the general slice (final review disputes ruling 17) | restores every-load behavior exactly | none. |
| FINAL | I4 (Windows/Linux-only Rust never compiled) is a release blocker, not a push blocker | CI runs macOS-independent cargo? report to user | a Windows build break found at release. |
| FINAL | M4 file-name drift (camelCase new files, editor-registry.port.ts holding an InjectionKey) parked for Wave 4 | renames churn imports with no behavior | naming lint later. |
