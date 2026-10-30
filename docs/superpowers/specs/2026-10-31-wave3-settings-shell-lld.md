## LLD: Wave 3 — Settings & shell

**Status**: Stable | **Version**: v1.0 | **Date**: 31-10-26 | **HLD**: `2026-10-30-wave-refactor-hld.md` v3.3 | **ADRs**: [0005](../../adr/0005-settings-slices.md), [0006](../../adr/0006-strict-ipc-validation-in-dev.md) | **Follows**: [Wave 2](2026-10-30-wave2-editor-lld.md)

Wave 3 splits the settings store into typed slices behind a versioned loader, renders the Settings modal from a page registry, decomposes `FileTree.vue`, `Toolbar.vue`, `commands.rs`, `git_pane/cli/actions.rs`, and brings every non-AI file to the final size budget. Behavior does not change. Old `solomd.settings.v1` blobs load to the same state.

### Baseline (measured 31-10-26, `main` at `09d66a61`)

| Fact | Value | Source |
|---|---|---|
| `stores/settings.ts` | 1793 lines: `Settings` 39–500, `PdfDefaults` 503–560, `defaults()` 575–786, `load()` 828–922, 170 actions 924–1793 | `grep -n` |
| `SettingsPanel.vue` | 2612: script 1–685, template 687–2277 (≈150 `data-cat` blocks, 19 page keys), style 2279–2612 | Haiku map |
| `FileTree.vue` | 2941: setup 1–1530, template 1532–1927, `FileTreeNode` script 1929–2169, style 2171–2941; 11 watch/hook registrations | Haiku map |
| `Toolbar.vue` | 1610: script 1–682, template 684–1216, style 1218–1610; no watchers | Haiku map |
| `commands.rs` | 1743; 19 commands registered as `commands::<name>` in `lib.rs:182` and `runner.rs:768` | Haiku map |
| `actions.rs` | 2705; `route_action` 1199–2180 (one `match`), in-file tests 2183–2705 | Haiku map |
| Direct blob readers | `stores/tabs.ts:70,84`, `stores/tiles.ts:30` parse `solomd.settings.v1` for flat keys | `grep` |
| Arch baseline | `fileSize` 68 (53 non-AI), `rawIpc` 0, `libPurity` 2 | `arch/baseline.json` |
| Tests | 1567 unit + 40 arch | `guard` |
| `guard` time (idle) | 70.6 s real; unit step 62.3 s | `/usr/bin/time -p pnpm --dir app guard` |

### Rulings

Decided without the user (yolo). Final for Wave 3. Ledger lines in `.superpowers/sdd/2026-10-31-wave3-pr*/progress.md` repeat each as `Ruling: <decision> — <reason> — cost if wrong: <x>`.

| # | Question | Ruling | Why | Cost if wrong |
|---|---|---|---|---|
| S1 | HLD §5 says the blob splits in Wave 4; the Wave 3 row says slices + migration now | Wave 3 splits the **schema** into slices and adds the versioned loader. The **stored blob never splits**: one flat object under `solomd.settings.v1`, plus a `settingsVersion` number. HLD §5 updated (v3.3) | `tabs.ts`/`tiles.ts` read flat keys from the blob; an older build reading a split blob would reset every setting. A flat blob is forward- and backward-compatible | A later wave adds a split step to the migration list; flat keys stay readable meanwhile |
| S2 | Slice shape | `SettingsSlice` = `id`, `schema` (Zod object over its keys), `defaults()`, optional `normalize(parsed, merged)` (today's per-key clamps). Keys are partitioned: each key in exactly one slice (test) | Mirrors `lib/theme/schema.ts` + `migrate.ts`; a partition makes ownership checkable | Re-grouping keys is a file move |
| S3 | Validation strength | Report mode, as IPC (ADR 0003): the loader runs today's normalizers unchanged; Zod checks each slice and reports drift in dev; a value is never dropped or reset by Zod. Unknown keys pass through and persist | "Old settings files must load unchanged"; a strict reset would wipe values older builds wrote with other types | Strict per slice later, behind golden fixtures |
| S4 | Versioning | `SETTINGS_VERSION = 2`. A blob without `settingsVersion` is v1. Step `1→2` runs today's one-time steps in today's order (zh→en, lens keybindings, the five marker migrations). Markers stay written | Older builds still read the markers and do not re-run their steps | One extra migration step |
| S5 | Proof | Golden fixtures captured from today's `load()` **before** the store changes: 8 pre-wave blobs (empty, v3.6 minimal, v4-beta, full current, tampered numbers, `zh`, legacy keybindings, unknown keys) → expected JSON. The new loader and the refactored store must both match | The only behavior check that does not depend on reading the code | — |
| S6 | Where slices live | `features/settings/internal/slices/<area>.slice.ts`, one per Settings IA area (14 areas). They move into a feature folder when one exists for them (AI slice in Wave 4) | 70% of keys have no feature folder yet | Cheap moves later |
| S7 | Store API | `stores/settings.ts` stays the Pinia store `settings` with the same state keys, getters and 170 action names (83 importers unchanged). Actions move to `features/settings/internal/actions/<area>.actions.ts` objects spread into `defineStore`, each method typed with an explicit `this: SettingsThis` | Zero importer churn; Options-store semantics (`$state`, `$patch`) unchanged | — |
| S8 | New file roles | `.slice.ts` (one settings slice: schema, defaults, normalize; no IPC, no Vue) and `.actions.ts` (store actions for one area; no IPC). Added to `file-roles.md` via ADR 0005 | A store split needs names the taxonomy lacks | Rename two suffixes |
| S9 | Settings UI from the registry | Each IA page is a multi-root page component (`features/settings/ui/pages/<Cat><Page>Page.vue`) whose `data-cat` blocks render as direct children of `.settings__body` (fragment), so search, `style.order` and `pageVisibilityCss` work unchanged. `shell/settings-registry.service.ts` lists slices and pages in order; `SettingsPanel.vue` renders `v-for` over the page list | Search and visibility depend on `[data-cat]` being direct body children (`SettingsPanel.vue:362`) | — |
| S10 | Page CSS | Block styles move to `features/settings/ui/settings-page.css`, loaded by `<style scoped src>` in every page component; modal chrome stays in `settings-panel.css` | Scoped CSS does not reach a child component's multi-root nodes | Duplicate CSS bytes, no behavior |
| S11 | Where moved Vue files go | `SettingsPanel.vue` → `features/settings/ui/`; `FileTree.vue` → `features/file-tree/ui/`; `Toolbar.vue` → `components/shell/toolbar/` (chrome, like `AppLayout`) | HLD: move into `features/` as a wave touches a file; `components/shell/` is the chrome folder (Wave 1b) | — |
| S12 | Watcher order | Composables extracted from `FileTree.vue` are called in today's registration order (220, 221, 476, 575, 584, hooks, 1112, 1132, 1150, 1522). A watcher reacting to an id/path change watches `[id, value]` and skips work on id change | Wave 2 regressions `3bfa4519`, `09d66a61` | One tab-switch bug |
| S13 | Rust command paths | `commands.rs` → `commands/` module; `generate_handler!` lists in `lib.rs` and `runner.rs` switch to `commands::<module>::<name>`. Command names unchanged | `quick_capture.rs:204` — `pub use` does not re-export the `__cmd__` item | A build error, caught by `cargo check` |
| S14 | Rust tests | In-file `#[cfg(test)] mod tests` move to sibling `tests.rs` (`#[cfg(test)] mod tests;`) when the file would exceed 600 lines; the size rule counts test lines | Rule counts every `.rs` line | — |
| S15 | Final budget | `fileSize` ends with AI files only: `ai_proxy.rs`, `agent_run.rs`, `agent_tools.rs`, `ollama.rs`, `rag.rs`, `recipes.rs`, `recipe_runner.rs`, `trace.rs`, `AISettings.vue`, `AgentPanel.vue`, `AgentSetupWizard.vue`, `AIRewriteOverlay.vue`, `McpProfilesSettings.vue`, `RecipesSettings.vue`, `TraceView.vue` (15). Every other entry (53) reaches ≤ 400/500/600 | HLD Wave 3 gate; the AI set is the Wave 4 surface (providers, agents, recipes, traces, RAG) | 15 files wait one wave |
| S16 | Editor registry edge | `features/editor/contracts` exports `EDITOR_REGISTRY_FACTORY` (an `InjectionKey<() => EditorFeatureRegistry>`); `App.vue` provides `createEditorRegistry`; `Editor.vue` injects it. The feature→shell import is deleted | Parked W2 | — |
| S17 | Feature purity | New arch rule `feature-purity`: under `features/`, only `ui/**`, `use*.ts`, `*.store.ts` may import `vue`/`pinia`. Baseline key `featurePurity` = today's violators (`cm-find-panel.ts`, `table-editor-bus.ts`, `formula-editor-bus.ts`). The two buses become `useTableEditorBus.ts` / `useFormulaEditorBus.ts` (`git mv` + rename) → baseline 1 | Parked W2; the buses are reactive singletons, i.e. composables | — |
| S18 | Test kit | `features/editor/internal/cm-probe.ts` → `features/editor/contracts/testkit.ts`; all importers switch | Parked W2 | — |
| S19 | Typed keys | `SettingsKey = keyof Settings`; `EditorFeature.settingsKeys: readonly SettingsKey[]`; one registry test checks every feature's keys sit in a registered slice. The 7 regex checks over `settings.ts` source are deleted | Parked W2; `vue-tsc` catches typos | — |
| S20 | i18n keys into features | Typed, not moved: `I18nKey` (dot-paths of `en`) types `EditorFeature.i18nKeys`; locale tables stay in `i18n/` | Moving 15 locale tables per feature is churn with no behavior; types give the check | Wave 4 can still move tables |
| S21 | `quick-capture-status` | `lib/quick-capture-status.ts` → `composables/useQuickCaptureStatus.ts` (App writes, Settings reads) → `libPurity` 1 | A Vue ref is host state | — |
| S22 | Wave 1 carry-overs | `PlatformUnsupportedError` → `platform/ipc/platform-error.ts`; `snakeToCamel` + `SnakeToCamel` → `platform/ipc/command-name.ts`; `command.port.ts` keeps types only. Dev validation mode `report` → `strict` (ADR 0006); prod stays `off` | Parked W1; strict in dev makes drift loud where it is cheap | Dev-only throw; one-line revert |
| S23 | Not folded in | W1 behavior fixes (`key=null` snippets, `icloud`, never-removed listeners), plain-engine pluggability, transform-case double handling, test gaps from W2 | Behavior changes or ADR-sized | Parked for Wave 4 |
| S24 | Parallel safety | One checkout. Each PR owns disjoint files (table below). Workers run only targeted tests and filter `vue-tsc` to their paths; the controller runs `verify` on the combined tree after each batch and commits per PR | Wave 2 precedent | A batch-level red needs one fix pass |
| S25 | Worker models | Implementers Sonnet; reviews Sonnet; final review Opus; read-only Haiku. Workers never commit, never spawn agents | User instruction | — |
| S26 | Browser check | `solomd-web-alt` (1430, may move to 1431): every Settings page, FileTree, Toolbar menus, editor typing; old-blob migration via seeded `localStorage`; asserts via JS, not screenshots; ⌘F via dispatched `KeyboardEvent` | User instruction + W2 lessons | — |

---

### PR graph

```yaml
prs:
  - id: pr-1
    name: "feat(settings): slice contract, versioned loader, golden fixtures, feature-purity rule, ADR 0005/0006"
    depends_on: []
  - id: pr-2
    name: "refactor(settings): store → slices + actions"
    depends_on: [pr-1]
    parallel_with: [pr-3, pr-4, pr-5, pr-6, pr-7, pr-12]
  - id: pr-3
    name: "refactor(settings): SettingsPanel → page components"
    depends_on: [pr-1]
  - id: pr-4
    name: "refactor(file-tree): FileTree → features/file-tree"
    depends_on: [pr-1]
  - id: pr-5
    name: "refactor(shell): Toolbar → components/shell/toolbar"
    depends_on: [pr-1]
  - id: pr-6
    name: "refactor(tauri): commands.rs → commands/ by domain"
    depends_on: [pr-1]
  - id: pr-7
    name: "refactor(git-pane): actions.rs → actions/ by action group"
    depends_on: [pr-1]
  - id: pr-12
    name: "refactor(platform): error + name helpers out of command.port; strict dev validation"
    depends_on: [pr-1]
  - id: pr-8
    name: "refactor(tauri): remaining Rust files to ≤ 600"
    depends_on: [pr-6, pr-7]
  - id: pr-9
    name: "refactor: remaining .ts files to ≤ 400"
    depends_on: [pr-2, pr-3, pr-4, pr-5]
  - id: pr-10
    name: "refactor: remaining .vue files to ≤ 500"
    depends_on: [pr-2, pr-3, pr-4, pr-5]
  - id: pr-11
    name: "refactor(settings): integrate — registry-rendered Settings, injected editor registry, typed keys, testkit, ratchet"
    depends_on: [pr-2, pr-3, pr-4, pr-5, pr-6, pr-7, pr-8, pr-9, pr-10, pr-12]
execution_order: [pr-1, [pr-2, pr-3, pr-4, pr-5, pr-6, pr-7, pr-12], [pr-8, pr-9, pr-10], pr-11]
```

Plans: `docs/superpowers/plans/2026-10-31-wave3-pr<N>-<slug>.md`. PR-8/9/10 each run as several workers over disjoint file groups (see their plans).

### File ownership (S24)

| PR | Owns (may edit) |
|---|---|
| 2 | `stores/settings.ts`, `features/settings/internal/{slices,actions}/**` |
| 3 | `components/SettingsPanel.vue` → `features/settings/ui/**`, `features/settings/internal/use*.ts`, `lib/settings-nav.template.test.ts`, `lib/quick-capture-status.ts`, `composables/useQuickCaptureStatus.ts`, `App.vue` (one import line), `components/shell/AppDialogs.vue` (import line) |
| 4 | `components/FileTree.vue` → `features/file-tree/**`, `composables/{useTreeDrag,useFileTreeReveal,useFileTreeNewFile}.ts` (move in), `components/shell/AppLayout.vue` (FileTree import line), importers of moved composables (import lines only) |
| 5 | `components/Toolbar.vue` → `components/shell/toolbar/**`, `components/shell/AppLayout.vue` (Toolbar import line), `styles/main.css` comment lines |
| 6 | `src-tauri/src/commands.rs` → `commands/**`, `lib.rs` + `runner.rs` handler lists, `replace.rs` import |
| 7 | `src-tauri/src/git_pane/cli/actions.rs` → `cli/actions/**`, `cli/mod.rs`, import lines in `engine.rs`, `commands.rs` (git_pane), `log.rs`, `diff.rs`, `tests_*.rs` |
| 12 | `platform/ipc/**`, `platform/index.ts`, importers of the two moved symbols (import lines) |
| 8 | the 13 Rust files in its plan + their new submodules + `mod` lines |
| 9 | the 19 `.ts` files in its plan + new siblings + import lines in their importers |
| 10 | the 14 `.vue` files in its plan + new children/composables |
| 11 | everything above, after the batch is committed |

Shared files (`arch/baseline.json`, `app/CLAUDE.md`, feature `CLAUDE.md`s): only the controller edits them, at commit time.

---

### PR-1 — Contracts

**Pattern**: Schema registry + versioned migration pipeline (precedent `lib/theme/schema.ts`, `lib/theme/migrate.ts` — `THEME_LAYER_VERSION`, pure `planMigration`). Report-mode validation (ADR 0003 precedent `platform/ipc/validation.service.ts`). Golden-master characterization (W2 E19).

**File tree**

```
app/src/features/settings/
├── CLAUDE.md
├── contracts/
│   ├── settings-slice.port.ts        # SettingsSlice, SettingsMigration, SETTINGS_STORAGE_KEY, SETTINGS_VERSION
│   └── index.ts
└── internal/
    ├── settings-load.service.ts      # loadSettings(raw, slices, migrations, report?) → { settings, hadStored }
    ├── settings-migrations.ts        # SETTINGS_MIGRATIONS (step 1→2 = today's one-time steps, verbatim order)
    ├── __fixtures__/blobs/*.json      # 8 pre-wave blobs
    ├── __fixtures__/expected/*.json   # today's load() output per blob (captured before PR-2)
    ├── settings-golden.test.ts       # today's store state == expected (pins PR-2)
    └── settings-load.service.test.ts
app/arch/feature-purity.rule.ts (+ .rule.test.ts, .arch.test.ts); baseline key featurePurity
docs/adr/0005-settings-slices.md, docs/adr/0006-strict-ipc-validation-in-dev.md
```

**Contracts (shapes)**

```typescript
// settings-slice.port.ts
SETTINGS_STORAGE_KEY = 'solomd.settings.v1'          // never changes (S1)
SETTINGS_VERSION = 2
interface SettingsSlice<S extends Record<string, unknown>> {
  id: string                                         // kebab
  schema: z.ZodObject<{ [K in keyof S]: z.ZodType<S[K]> }>
  defaults(): S
  normalize?(parsed: Readonly<Record<string, unknown>>, merged: S & Record<string, unknown>): void  // today's clamps, in place
}
interface SettingsMigration { to: number; up(raw: Record<string, unknown>, env: { isMobile: boolean }): Record<string, unknown> }
type DriftReporter = (message: string) => void       // `[settings:drift] <slice>.<key>: <issue>`

// settings-load.service.ts
loadSettings(raw: string | null, slices, migrations, opts?: { report?: DriftReporter; isMobile?: boolean }):
  { settings: Record<string, unknown>; hadStored: boolean }
  // null / bad JSON → merged defaults, hadStored false (today: catch → defaults())
  // else: parse → migrations with to > (settingsVersion ?? 1), in order → { ...allDefaults, ...parsed } →
  //       slice.normalize in registration order → settingsVersion = SETTINGS_VERSION → report-mode Zod per slice
```

Order inside today's `load()` is behavior (e.g. `userThemes` before `activeUserThemeId`, `mindmapFolderTagRules` only when present). PR-2 keeps it: `normalize` runs per slice in the order the registry lists; the golden test catches any reorder.

**Test surface**

```yaml
tests:
  unit:
    - "golden: for each fixture blob, a fresh Pinia store (localStorage stub seeded) has $state deep-equal expected/<name>.json (minus settingsVersion until PR-2 adds it)"
    - "loader: no raw / bad JSON → defaults, hadStored false; unknown key passes through; drift reported once per key, value kept"
    - "migrations: blob without settingsVersion runs step 2; blob at 2 runs none; markers written"
    - "feature-purity rule: fixture tree — internal/x.service.ts importing vue fails; ui/X.vue and internal/useX.ts pass"
  new_helpers:
    - { name: withLocalStorage, signature: "(seed: Record<string,string>) => { restore(): void }", file: "app/src/features/settings/internal/local-storage-stub.ts" }
```

**Seams**: (1) fixtures + golden test against today's store (expected JSON generated by a one-off script, committed); (2) port + loader + migrations + tests; (3) `feature-purity` rule + baseline; (4) ADR 0005, ADR 0006, HLD v3.3 §5, `file-roles.md` roles, `features/settings/CLAUDE.md`.

---

### PR-2 — Store → slices + actions

**Pattern**: Partitioned schema (one slice per IA area) + Options-store action mixins (S7).

| Slice (`<area>.slice.ts`) | Keys (from `Settings`) |
|---|---|
| `general` | language, uiFontSize, globalZoom, wheelZoom*, showStatusBarViewModes, fonts, editor-display toggles |
| `layout` | sidebars, panes, outline, widths, right-sidebar state, `_rsPanesBeforeHide`, rs pane order/heights, toolbarHidden, formatHints |
| `explorer` | showFileTree, explorer*, explorerSortByFolder, fileTreeWidth |
| `preview` | preview*, markdown*, smartQuotes, plantuml*, readingByDefaultOnMobile |
| `appearance` | theme, appearance, lightSlot, darkSlot, userThemes, activeUserThemeId, customCssPath, themeLayerVersion |
| `writing` | spellcheck*, vimMode, slash, directive, focus, typewriter, writing stats, pomodoro*, windowsEditorEngine |
| `attachments` | attachment*, assetsDirName, image upload (picgo/smms/s3/gh*) |
| `inbox` | dailyNotes*, inbox* |
| `mindmap` | mindmap* |
| `git` | autoGit*, git*, history panel |
| `integrations` | rag, quickCapture*, workspaceBibliography/Csl |
| `ai` | ai*, agent*, showAgentPanel (Wave 4 owner) |
| `export` | pdfDefaults, docxPreset, printTheme, imageExportBranding |
| `app` | viewMode, startupViewMode, lastNonReadingViewMode, keybindings, startup/update/telemetry/session/file-behaviour flags, one-time markers, welcome/wizard flags |

Exact key lists are the plan's job; the partition test enforces completeness. `stores/settings.ts` keeps `useSettingsStore`, `defaults()`, `hadStoredSettings()`, `buildEditorFontStack`, `setRightSidebarShell`, `PdfDefaults`, `defaultPdfDefaults` as exports (re-exported where moved). Target ≤ 400.

**Tests**: golden test from PR-1 green (now including `settingsVersion: 2`); partition test (each `keyof Settings` in exactly one slice; union of slice defaults deep-equals `defaults()`); one test per slice that `normalize` reproduces today's clamp for an out-of-range value; existing 1567 green.

**Seams**: (1) slices (schema + defaults + normalize) + partition test; (2) store uses `loadSettings`; (3) actions moved per area; store ≤ 400.

---

### PR-3 — SettingsPanel → page components

| Target | From `SettingsPanel.vue` |
|---|---|
| `features/settings/ui/SettingsPanel.vue` | modal, search box, nav, breadcrumb, body, `ThemeMarketplace`; `v-for` over `SETTINGS_PAGES` |
| `features/settings/internal/settings-pages.ts` | ordered `{ key: PageKey, component }[]` (19) |
| `ui/pages/*.vue` (19, multi-root) | the `data-cat` blocks of that page in today's relative order |
| `internal/useSettingsSearch.ts` | 281–410 (query, highlight, `applySearch`, observer, page-visibility `watchEffect`) |
| `internal/useSettingsNavigation.ts` | 89–96, 248–265, 412–460 |
| `internal/useShortcutEditor.ts` | 104–210 |
| `internal/useFontPicker.ts`, `usePdfDefaultsForm.ts`, `useThemeSlots.ts`, `useSpellDicts.ts`, `useDirectiveStatus.ts`, `useUpdateCheck.ts` | 597–640, 642–684, 536–595, 463–485, 486–500, 212–246 |
| `ui/settings-panel.css`, `ui/settings-page.css` | style 2279–2612 split (S10) |

`settings-nav.template.test.ts` reads every page file (same regex, same assertions) plus a new check: `SETTINGS_PAGES` keys equal `ALL_PAGE_KEYS` in order. `quick-capture-status` move (S21). Browser check: every page renders its sections, search finds `font` and `pdf` across pages, deep link `writing/image-upload`.

**Seams**: (1) composables, panel still owns the template; (2) page components + `settings-pages.ts`; (3) `git mv` to `features/settings/ui/`, CSS split, `quick-capture-status` move.

---

### PR-4 — FileTree → `features/file-tree/`

| Target | From `FileTree.vue` |
|---|---|
| `ui/FileTree.vue` (≤ 500) | composition root, template shell, watcher registration in today's order (S12) |
| `ui/FileTreeNode.ts` | 1929–2169 (render-function component, `FTREE_EDIT`) |
| `ui/FileTreeHeader.vue`, `FileTreeContextMenu.vue`, `FileTreeSwitcher.vue`, `FileTreeDeleteDialog.vue` | template regions 1545–1650, 1792–1880, 1657–1696, 1901–1925 |
| `internal/useTreeSort.ts`, `useTreeLoad.ts`, `useTreeFilter.ts`, `useTreeRefresh.ts`, `useTreeEdit.ts`, `useTreeMove.ts`, `useTreeDragDrop.ts`, `useTreeRevealRow.ts`, `useTreeResize.ts`, `useWorkspaceSwitcher.ts` | script chunks 81–111, 273–360, 361–492, 493–590, 591–675, 676–833 + 1309–1447, 834–988, 989–1308, 1020–1164, 1458–1505 |
| `internal/useTreeDrag.ts`, `useFileTreeReveal.ts`, `useFileTreeNewFile.ts` | `git mv` from `composables/`; outside users import via `contracts/index.ts` |
| `ui/file-tree.css` (+ split if > 500) | style 2171–2941 |

**Tests**: pure helpers pulled out while moving get characterization tests first (`orderKey`/`sortChildren`, `segmentsUnderRoot`, `joinPath`, `rootRelative`, `reorderAt`/`destinationAt`); a source-order test asserts `FileTree.vue` calls the composables in S12 order. Browser: expand, rename, new file, sort, filter, drag reorder, follow active tab.

---

### PR-5 — Toolbar → `components/shell/toolbar/`

`Toolbar.vue` (root, emits unchanged) + `ToolbarFileGroup.vue` (740–874), `ToolbarInsertMenu.vue` (908–1004), `ToolbarViewModes.vue` (1032–1099), `ToolbarTools.vue` (1103–1172), `WindowsMenubar.vue` (706–732 + 447–540), `WindowsCaption.vue` (1190–1214 + 561–633); composables `useToolbarDropdowns.ts` (346–381, 436–445, 634–671), `useToolbarOverflow.ts` (77–105, 542–559), `useTitleBar.ts` (143–193), `toolbar-actions.ts` (pure-ish handlers 195–434, no Vue); `toolbar.css` split. Dropdown exclusivity (`closeAllDropdowns`) stays in one composable shared through `provide/inject` (`TOOLBAR_DROPDOWNS` key). Browser: each dropdown opens/closes exclusively, outside click closes, view-mode buttons, overflow ⋯ at 700px width.

---

### PR-6 — `commands.rs` → `commands/`

```
src-tauri/src/commands/
├── mod.rs              # pub mod lines; pub use of plain helpers used elsewhere (write_file_inner)
├── file_io.rs          # read_file, write_file, read/write_binary_file, sniff_bom, detect_language, FileReadResult (+ tests)
├── fs_ops.rs           # copy_file, fs_create_*, fs_delete, fs_*_exists, fs_rename + rename asset rewrite
├── fs_move.rs          # fs_move, move/copy tree
├── link_rewrite.rs     # relink_moved_tree, rewrite_links_after_move, lexical_*, regexes
├── fs_list.rs          # fs_list_dirs, fs_list_extensions, fs_dirs_with_extensions, filtered_walk
├── list_dir.rs         # list_dir, DirEntry, entry_times (+ tests)
├── frontmatter.rs      # update/delete_frontmatter_property + YAML block helpers
└── print.rs            # print_webview (desktop/mobile)
```

`lib.rs` and `runner.rs` handler lists name `commands::<module>::<name>` (S13). Tests: existing in-file tests move with their code; `cargo test` green; `cargo check` green.

### PR-7 — `actions.rs` → `actions/`

```
src-tauri/src/git_pane/cli/actions/
├── mod.rs           # execute_action, route_action (dispatch only: match kind → group fn), pub use of public types
├── classify.rs      # classify_git_error, extract_conflict_files, lfs helpers
├── run.rs           # RunResult, RunOptions, Operations, run_git, run_git_streaming, probe, remote_timeout_for
├── journal.rs       # Journal*, Checkpoint, undo/redo, is_journalable_action, journal_label
├── rebase_bundle.rs
├── envelope.rs      # ExecutedGitCommand, ActionEnvelope, format/record helpers
├── args.rs          # meta_*, checked_*, reject_option_like, escape_glob, truncate_output
├── routes_*.rs      # remote, stash, stage, conflicts, commit, branch, history (merge/rebase/cherry/bisect/reset/revert), tags, misc
└── tests/*.rs       # 2183–2705 split by subject
```

`checked_rev`, `escape_glob` stay `pub(crate)` at `actions::` via re-export (callers `log.rs`, `diff.rs`). Each route group fn takes the same locals `route_action` binds today.

### PR-12 — Platform carry-overs

`platform/ipc/platform-error.ts` (`PlatformUnsupportedError`), `platform/ipc/command-name.ts` (`snakeToCamel`, `SnakeToCamel`); `command.port.ts` re-exports nothing new (importers switch). `resolveValidationMode()`: DEV → `strict`. Tests: moved symbols keep their tests; validation-mode test.

### PR-8 / PR-9 / PR-10 — Remaining budget (S15)

| PR | Files (lines) | Worker groups |
|---|---|---|
| 8 (.rs ≤ 600) | `capture_endpoint` 1341, `convert` 602, `crypto` 707, `git_history` 737, `git_pane/cli/{diff 1332, git 1061, refs 1144}`, `github_sync` 1538, `image_upload` 783, `integrations` 734, `rest_api` 930, `runner` 1129, `workspace_index` 1426 | A: git_pane cli trio + git_history; B: github_sync, workspace_index, capture_endpoint; C: the other 6 |
| 9 (.ts ≤ 400) | `useCommands` 818, `useExport` 688, `useFiles` 1042, `dev/pdf-harness` 431, `image-upload/internal/cm-image-paste` 671, `lib/{bases 815, citations 421, cm-live-render 1020, cm-slash-commands 557, docx-export 764, git-pane/shared/models 450, image-overlay 608, keybindings 639, markdown 1184, pdf-export 628, pdf-options 496, viewFile 505}`, `stores/{githubSync 466, pomodoro 409, tabs 568}` | A: composables; B: markdown, cm-live-render, cm-slash-commands, image-overlay, cm-image-paste; C: export/pdf/docx/citations/pdf-harness; D: bases, keybindings, viewFile, models, stores |
| 10 (.vue ≤ 500) | `BasesView` 839, `CjkProofread` 586, `GithubSyncSettings` 1417, `GlobalSearch` 615, `IntegrationsSettings` 706, `MarkdownHelp` 671, `MindmapCanvas` 1183, `MindmapView` 524, `PaneContent` 526, `PaneTabBar` 724, `Preview` 1424, `RelationshipsPanel` 591, `Slideshow` 501, `ThemeStudio` 579 | A: Preview, PaneContent, PaneTabBar, Slideshow; B: MindmapCanvas, MindmapView, BasesView, RelationshipsPanel; C: GithubSyncSettings, IntegrationsSettings, ThemeStudio; D: GlobalSearch, MarkdownHelp, CjkProofread |

Method per file: extract pure helpers first (characterization tests), then composables / child components / co-located CSS (`<style scoped src>`) / Rust submodules. Public exports keep their names and paths (entry file re-exports). `lib/` stays pure. A file's existing tests stay green unedited except import paths.

### PR-11 — Integrate

| Seam | Change |
|---|---|
| 1 | `shell/settings-registry.service.ts`: `SETTINGS_SLICES` (ordered) + `SETTINGS_PAGES`; store and panel read from it; registry tests (partition, page keys = `ALL_PAGE_KEYS`, feature `settingsKeys` ⊂ slice keys) |
| 2 | `SettingsKey`, `I18nKey` types; `EditorFeature.settingsKeys`/`i18nKeys` typed; delete 7 regex checks + `resolveKey` checks |
| 3 | `EDITOR_REGISTRY_FACTORY` provide/inject (S16) |
| 4 | `cm-probe.ts` → `contracts/testkit.ts` (S18); buses → `useTableEditorBus.ts`/`useFormulaEditorBus.ts` (S17) |
| 5 | `tabs.ts`/`tiles.ts` read flags through `readStoredSetting(key)` from `features/settings/contracts` |
| 6 | `arch:rebaseline` (`fileSize` → 15 AI files, `libPurity` 1, `featurePurity` 1); docs; HLD status row |

---

### Observability

No new log points. New dev-only reporter line `[settings:drift] <slice>.<key>: <issue>` (report mode, once per key). Existing `[platform:drift]` lines become throws in dev (ADR 0006). No metrics, no audit (desktop app).

### Migration safety

| Step | Pre-flight | Rollback | Partial failure |
|---|---|---|---|
| `settingsVersion` 1→2 | Golden fixtures pass on today's code before the store changes (PR-1 seam 1) | Older build ignores `settingsVersion` and the flat keys are unchanged; markers still present, so no step re-runs | The loader is pure; on throw it falls back to defaults exactly as today's `catch {}` |

`localStorage` key, flat key names and value types never change. No Rust-side persisted data changes. Rollback of any PR = revert its commits.

### Conventions check

**Honored**
- Feature folder `contracts/ internal/ ui/ CLAUDE.md`; outside imports via `contracts/` (`docs/conventions/file-roles.md` §Feature folder)
- Roles `.port.ts`, `.service.ts`, `.rule.ts`, `.arch.test.ts`, `.test.ts`; composables `useX.ts` (`file-roles.md` §Roles; `app/CLAUDE.md` §Map composables row)
- Ratchets only shrink; moved keys renamed by hand (root `CLAUDE.md` Invariant 2; `app/arch/CLAUDE.md` §Moving)
- `lib/` stays pure; `quick-capture-status` leaves it (Invariant 4)
- No new `@tauri-apps/*` outside `platform/` (Invariant 3)
- ADRs for the two expensive-to-reverse choices (Invariant 1; `docs/adr/README.md`)
- Doc sync per area `CLAUDE.md` (Invariant 6)

<conventions-check explicit_deviations="0" implicit_deviations="2">
- (implicit) `features/settings/internal/settings-migrations.ts`, `settings-pages.ts`, `toolbar-actions.ts` — no role suffix, against `file-roles.md` §Naming "A file with no clear single role is a sign to split it". Rationale: constant tables / handler bags; precedent `features/editor/internal/cm-api.ts`.
- (implicit) `features/file-tree/ui/FileTreeNode.ts` — a component in a `.ts` file, against `file-roles.md` §Naming "Vue components keep PascalCase `.vue`". Rationale: it is a render-function `defineComponent` today (`FileTree.vue:1977`); converting it to SFC is a behavior risk.
</conventions-check>

`.slice.ts` and `.actions.ts` are not deviations: ADR 0005 adds them to `file-roles.md` in PR-1.

---

### LLD AI Context YAML

```yaml
lld_version: v1.0
feature: "Wave 3 — Settings & shell"
hld_version: v3.3
status: stable
pr_count: 12
execution_order: [pr-1, [pr-2, pr-3, pr-4, pr-5, pr-6, pr-7, pr-12], [pr-8, pr-9, pr-10], pr-11]
open_items: []
conventions_check:
  explicit_deviations: 0
  implicit_deviations: 2
dev_ready: true
```
