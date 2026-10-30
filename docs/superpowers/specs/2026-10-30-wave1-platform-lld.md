## LLD: Wave 1 — Platform seam

**Status**: Done | **Version**: v1.1 | **Date**: 30-10-26 | **HLD**: `2026-10-30-wave-refactor-hld.md` v3.1 | **ADR**: [0003](../../adr/0003-platform-ports.md)

Wave 1 puts every Tauri call behind typed ports in `app/src/platform/` and splits five services out of `App.vue`. Behavior does not change: adapters pass IPC results and errors through untouched.

### Baseline (measured 30-10-26)

| Fact | Value | Source |
|---|---|---|
| `invoke(` sites | 247 in 59 files (169 distinct commands) | `grep -rnE "invoke(<.*>)?\(" app/src` excl. tests |
| `@tauri-apps/*` importers | 81 files, 11 modules | `api/core` 58, `plugin-opener` 17, `api/event` 16, `plugin-dialog` 12, `plugin-clipboard-manager` 10, `api/window` 5, `api/path` 5, `api/webview(Window)` 4, `plugin-fs` 3, `api/app` 3, `api/image` 2, `plugin-deep-link` 1 |
| Arch baseline | `fileSize` 71, `rawIpc` 59, `libPurity` 21 | `app/arch/baseline.json` |
| `App.vue` | 2511 lines | `wc -l` |
| Unit tests | 1153 + 38 arch | `pnpm --dir app guard` |

### Rulings

Decisions made without the user (yolo mode). Each is final for Wave 1.

| # | Question | Ruling | Why |
|---|---|---|---|
| R1 | Port shape for 169 commands | Command catalog per domain (`{ cmd: { args?, result } }` Zod); port type derived, methods camelCase | One entry per command; no hand-written method lists to drift (ADR 0003) |
| R2 | Adapters | Generic `createTauriPort` / `createWebPort`; per-domain adapter files are one-liners | HLD NFR "every port has a tauri and a web adapter" at minimal code |
| R3 | Runtime validation | Return raw result; `safeParse` in `report` (dev), `off` (prod), `strict` (tests) | Unit tests cannot run Rust; a wrong schema must not break the app. Behavior unchanged |
| R4 | Errors | Tauri adapter never wraps errors; web adapter throws/rejects `PlatformUnsupportedError` where the web build fails today | Callers match on error strings from Rust |
| R5 | Domains | 6 HLD domains split to fit 400-line ports: `fs`, `android`, `git-sync`, `git-history`, `git-pane`, `ai`, `ai-tools`, `rag`, `settings`, `capture`, `convert`, `cloud`, `window` + non-command ports `events`, `dialog`, `clipboard`, `opener`, `path` (incl. `plugin-fs`) | HLD domains are too big for one ≤ 400-line file; plugins are not commands |
| R6 | Parallel PRs | Migration PRs own disjoint **file sets**, grouped by the domain that owns most of each file's calls; a file's PR migrates all of its calls | Workers share one checkout; disjoint files make PRs safe to run at once |
| R7 | `raw-ipc` rule | PR-1 exempts `app/src/platform/**`; PR-10 widens the match from `@tauri-apps/api/core` to any `@tauri-apps/` import and empties `rawIpc` | Widening earlier would fail 22 non-core importers that are not in the baseline |
| R8 | `lib/` files that do IPC | Call ports in Wave 1 (`lib/` → `platform/` allowed); moving them into `features/` is Wave 2 | Invariant 4 bans `vue`/`pinia`/`@tauri-apps`, not ports; moving now doubles the diff |
| R9 | App.vue services | Plain TS `createXService(deps)` in `app/src/shell/*.service.ts`; deps injected (ports, store callbacks); `App.vue` wires them in `onMounted`/`onUnmounted` | File roles: `.service.ts` has no `vue`/`pinia`; injected deps make services unit-testable |
| R10 | Import path | Callers import `../platform/index.ts` (with extension) | Node type-stripping tests need the extension (`app/CLAUDE.md` §Tests) |
| R11 | Git pane | `lib/git-pane/service.ts` `GitPaneService` stays the port; `tauriGitService.ts` moves to `platform/git-pane/git-pane.tauri.adapter.ts` using the IPC gateway | Already a port + validator; don't duplicate |
| R12 | Baselined files | A migrated file must not grow past its `fileSize` entry; non-baselined files stay within budget | Ratchets only shrink (Invariant 2) |
| R13 | Worker model | Implementation workers on Sonnet, layer reviews on Sonnet, final PR review on Opus, read-only on Haiku | User instruction; CLAUDE.md dispatch rules |

---

### PR graph

```yaml
prs:
  - id: pr-1
    name: "feat(platform): ports, catalogs, adapters (no callers)"
    depends_on: []
    location: "app/src/platform/, app/arch/raw-ipc.rule.ts, docs/adr/0003"
  - id: pr-2
    name: "refactor(fs): composables call platform ports"
    depends_on: [pr-1]
    parallel_with: [pr-3, pr-4, pr-5, pr-6, pr-7, pr-8, pr-9]
  - id: pr-3
    name: "refactor(fs): components, lib, stores call platform ports"
    depends_on: [pr-1]
  - id: pr-4
    name: "refactor(git): git stores and panels call platform ports"
    depends_on: [pr-1]
  - id: pr-5
    name: "refactor(ai): AI components and stores call platform ports"
    depends_on: [pr-1]
  - id: pr-6
    name: "refactor(rag): rag + workspace index call platform ports"
    depends_on: [pr-1]
  - id: pr-7
    name: "refactor(settings): settings, capture, themes call platform ports"
    depends_on: [pr-1]
  - id: pr-8
    name: "refactor(window): window, opener, clipboard callers use ports"
    depends_on: [pr-1]
  - id: pr-9
    name: "refactor(shell): split App.vue into five services"
    depends_on: [pr-1]
  - id: pr-10
    name: "chore(arch): integrate gate — ban @tauri-apps outside platform"
    depends_on: [pr-2, pr-3, pr-4, pr-5, pr-6, pr-7, pr-8, pr-9]
execution_order: [pr-1, [pr-2, pr-3, pr-4, pr-5, pr-6, pr-7, pr-8, pr-9], pr-10]
```

Plans: `docs/superpowers/plans/2026-10-30-wave1-pr<N>-<slug>.md`, one per PR.

---

### PR-1 — Contracts

**Pattern**: Hexagonal ports + adapters (`sdlc-arch` §hex-arch); catalog-derived port types (precedent: `lib/git-pane/service.ts` port + `validate.ts` guards); Zod at the boundary (`lib/theme/schema.ts`).

**File tree**

```
app/src/platform/
├── CLAUDE.md                          # how to add a command, validation modes, adapter rules
├── index.ts                           # isTauri() → adapter; exports one instance per port
├── index.test.ts                      # node (no Tauri) → every port is the web adapter
├── ipc/
│   ├── command.port.ts                # CommandCatalog, CommandPort<C>, SnakeToCamel, PlatformUnsupportedError
│   ├── command.tauri.adapter.ts       # createTauriPort(catalog, invoke, validation)
│   ├── command.web.adapter.ts         # createWebPort(catalog, overrides?)
│   ├── validation.service.ts          # mode: off | report | strict; reporter
│   ├── catalog-contract.ts            # test helper: runCatalogContract(name, catalog, fixtures)
│   └── *.test.ts
├── fs/            fs.port.ts  native-fs.port.ts  + .tauri/.web adapters + tests
├── android/       android.port.ts
├── git-sync/      git-sync.port.ts
├── git-history/   git-history.port.ts
├── git-pane/      (adapter arrives in PR-4)
├── ai/            ai.port.ts  ai-tools.port.ts
├── rag/           rag.port.ts
├── settings/      settings.port.ts  capture.port.ts
├── convert/       convert.port.ts
├── cloud/         cloud.port.ts
├── window/        window.port.ts (hand) + window-commands.port.ts (catalog)
├── events/        events.port.ts
├── dialog/        dialog.port.ts
├── clipboard/     clipboard.port.ts
├── opener/        opener.port.ts
└── path/          path.port.ts
```

Every `<x>.port.ts` has `<x>.tauri.adapter.ts`, `<x>.web.adapter.ts` and `<x>.port.test.ts` beside it.

**Contracts (shapes, not code)**

```typescript
// ipc/command.port.ts
CommandSpec   = { args?: ZodType; result: ZodType }
CommandCatalog = Record<snake_case_string, CommandSpec>
CommandPort<C> = { [K in keyof C as SnakeToCamel<K>]:
                   C[K]['args'] extends ZodType ? (args: z.input<args>) => Promise<z.output<result>>
                                                : () => Promise<z.output<result>> }
class PlatformUnsupportedError extends Error { readonly operation: string }

// ipc/command.tauri.adapter.ts
createTauriPort<C>(catalog: C, invoke: InvokeFn, validation: Validation): CommandPort<C>
  // method(args) → validation.check(cmd,'args',spec.args,args) → invoke(cmd, args) → validation.check(cmd,'result',spec.result,raw) → raw
// ipc/command.web.adapter.ts
createWebPort<C>(catalog: C, overrides?: Partial<CommandPort<C>>): CommandPort<C>
  // every method not overridden → Promise.reject(new PlatformUnsupportedError(cmd))
// ipc/validation.service.ts
type ValidationMode = 'off' | 'report' | 'strict'
createValidation(mode, report = console.warn): { check(cmd, part, schema, value): void }
  // report → `[platform:drift] <cmd> <part>: <zod issue summary>`; strict → throw
```

Hand ports (non-command) list only the functions callers use today: `events` (`listen`, `emit`), `dialog` (`open`, `save`, `message`, `ask`, `confirm` as used), `clipboard` (`readText`, `writeText`, `writeHtml`, `writeImage`), `opener` (`openUrl`, `openPath`, `revealItemInDir`), `path` (`sep`, `join`, `tempDir`, `documentDir`, `desktopDir`, `homeDir`, `readFile`, `exists`, `writeTextFile`), `window` (current-window ops, webview drag-drop + zoom, `WebviewWindow` creation, deep link, `getVersion`, `Image.fromBytes`). Their tauri adapter takes the plugin module as an injected dependency (default: the real module; lazy `import()` kept where callers use it today). Sync functions stay sync.

**Raw-IPC rule change**: `collectRawIpc` skips `app/src/platform/**` (R7).

**Test surface**

```yaml
tests:
  unit:
    location: "app/src/platform/**/*.test.ts"
    coverage:
      - "command.tauri.adapter: calls invoke with the exact snake command + args; returns raw result (not parsed); passes rejections through unchanged"
      - "command.tauri.adapter: strict mode throws on bad result; report mode logs once and returns raw; off mode never parses"
      - "command.web.adapter: unsupported command rejects PlatformUnsupportedError naming the command; overrides win"
      - "SnakeToCamel runtime == type (ai_list_models → aiListModels)"
      - "each catalog: every command has a result schema; one fixture per command parses in strict mode (runCatalogContract)"
      - "each hand port: tauri adapter forwards to injected fake module; web adapter rejects/throws PlatformUnsupportedError"
      - "index.ts in Node picks web adapters"
      - "raw-ipc.rule: a platform/ file importing @tauri-apps/api/core is not a violation"
    new_helpers:
      - name: "runCatalogContract"
        signature: "(name: string, catalog: CommandCatalog, fixtures: Record<string, { args?: unknown; result: unknown }>) => void"
        file: "app/src/platform/ipc/catalog-contract.ts"
```

**Seams**

| Seam | Leaf-group | Why green |
|---|---|---|
| 1 | `ipc/*`, `raw-ipc.rule.ts` exemption | Generic core + tests; no domain yet |
| 2 | 18 domain/hand ports (parallel, one dir each) | Each port self-contained with its contract test; no callers |
| 3 | `index.ts`, `platform/CLAUDE.md`, `app/CLAUDE.md` map row, ADR 0003 | Composition + docs; still no callers |

---

### PR-2…PR-8 — Migrations (parallel)

**Pattern**: Strangler fig per file — replace each `invoke('x', a)` with `<port>.x(a)` and each plugin import with its port; delete the `@tauri-apps/*` import. Extract-in-place, behavior unchanged.

**Mechanics per file** (identical for every migration PR)
1. Swap `import { invoke } from '@tauri-apps/api/core'` (and other `@tauri-apps/*`) for `import { <ports> } from '<rel>/platform/index.ts'`.
2. `invoke<T>('snake_cmd', args)` → `<port>.snakeCmd(args)`. Drop `<T>` when the catalog result type matches; if it does not, fix the catalog schema (not the caller) and add a fixture.
3. Keep surrounding `try/catch`, `isTauri()` and `hasGitBackend()` guards as they are.
4. Line count: never above the file's `fileSize` baseline (R12).
5. After each PR: `pnpm --dir app arch:rebaseline` drops the migrated files from `rawIpc`/`libPurity`.

**File ownership** (R6; 81 files, each in exactly one PR)

| PR | Files |
|---|---|
| PR-2 fs composables (16) | `composables/` `useFiles`, `useExport`, `useFileWatcher`, `useConvertedOutput`, `useDailyNotes`, `useFolderReplace`, `useFolderTreeScan`, `useGlobalSearch`, `useMindmapExport`, `useMindmapFolderFiles`, `useMindmapWorkbench`, `usePandocExport`, `useProperties`, `useRelationships`, `useTasks`, `useMindmapCanvasActions` |
| PR-3 fs components/lib/stores (16) | `components/` `FileTree`, `Preview`, `ThemeMarketplace`, `AndroidFolderPicker`, `MindmapFolderTree`, `MindmapConvertFolder`, `MindmapWorkbench`, `CitationPickerSettings`, `TabBar`; `lib/` `cm-image-paste`, `image-resolve`, `docx-export`, `saf-fs`; `stores/` `properties`, `types`, `theme` |
| PR-4 git (7) | `stores/` `githubSync`, `gitHistory`, `cloudSync`; `components/git/` `GitCommitPanel`, `GitEmptyState`; `components/GithubSyncSettings`; `lib/git-pane/tauriGitService` (moves to `platform/git-pane/`) |
| PR-5 ai (12) | `components/` `AISettings`, `AIRewriteOverlay`, `AgentPanel`, `AgentSetupWizard`, `CjkProofread`, `CostMeterSettings`, `RecipesSettings`, `McpProfilesSettings`, `IntegrationsSettings`; `stores/` `recipes`, `agentTrace`, `mcpProfiles` |
| PR-6 rag (4) | `stores/` `rag`, `workspaceIndex`; `components/` `ViewsPanel`, `ViewNoteList` |
| PR-7 settings (10) | `components/` `SettingsPanel`, `CaptureEndpointSettings`, `RestApiSettings`, `QuickCapture`; `lib/theme/sources`, `stores/themes`, `lib/cm-spellcheck`, `lib/directive-completion-registry`, `lib/image-upload`, `composables/useCommands` |
| PR-8 window/system (15) | `composables/useShortcuts`; `components/` `Toolbar`, `Slideshow`, `ReadingView`, `AboutDialog`, `Editor` (clipboard only), `MindmapDetailsPane`, `properties/value-cells/UrlCell`; `lib/` `check-update`, `telemetry`, `new-window`, `reveal-in-file-manager`, `open-google-translate`, `code-copy`, `devtools` |
| PR-9 shell (1) | `App.vue` |

**Test surface** (each migration PR)

```yaml
tests:
  unit:
    coverage:
      - "Existing tests for touched files stay green (count never drops)"
      - "Any catalog schema fixed during migration gets a fixture in its <domain>.port.test.ts"
  arch:
    coverage:
      - "rawIpc / libPurity entries for the PR's files are gone after arch:rebaseline"
```

**Seams**: one seam per worker task (3–5 files that share a port), then a closing seam `baseline.json` + nearest `CLAUDE.md`.

---

### PR-9 — App.vue → five shell services

**Pattern**: Extract Service with injected dependencies (functional core, imperative shell). Services own logic and Tauri wiring through ports; `App.vue` keeps Vue reactivity (`watch`, `watchEffect`, refs) as one-line calls into services (R9).

**File tree**

```
app/src/shell/
├── CLAUDE.md
├── window.service.ts       + .test.ts
├── file-open.service.ts    + .test.ts
├── shortcuts.service.ts    + .test.ts
├── session.service.ts      + .test.ts
└── updates.service.ts      + .test.ts
```

**What moves** (line ranges in `App.vue` at `e0c3cd23`)

| Service | Moves from App.vue | Ports used |
|---|---|---|
| `window` | wheel zoom 410-447; `applyWindowTitle` 567-585; webview zoom 625-640 body; stale `solomd.window.v1` key 1037-1039; `onWindowBlur` 1043-1045; aux-window cleanup 1237-1246; `close-requested` 1281-1290; `window-destroyed` 1297-1303 | `window`, `events`, `windowCommands` |
| `file-open` | Android picker/restart/storage 154-192; `openExternalFile` 877-888; onMounted Android 1053-1113; `opened-file` 1154-1160; Android DOM events 1162-1171; deep link 1173-1201; `drain_pending_opens` 1203-1210; `?path=` 1212-1221; drag-drop 1317-1345 | `events`, `window`, `android`, `windowCommands`, `opener` |
| `shortcuts` | `onZoomShortcut` 450-487; `onEsc` 489-505; menu sync 705-716 body; quick-capture shortcut 749-762 body; help/search/CJK handlers 835-843; `dispatchMenuAction` 890-1025; `onDomMenuAction` 1027-1030; `menu` listen 1305-1315 | `windowCommands`, `settings`, `capture`, `events`, `clipboard`, `window` |
| `session` | persist on tabs/tiles change 527-549 (handler bodies); tiles init 1275-1279; persist-before-close used by `window` | none (stores via deps) |
| `updates` | startup update check + toast 1347-1366 | `opener` (via `lib/check-update`) |

**Contract shape** (each service)

```typescript
createXService(deps: XDeps): XService
XService = { start(): Promise<void> | void; stop(): void; /* + handlers App.vue binds */ }
XDeps    = ports + narrow callbacks into stores/refs (e.g. getActiveTab(), openPath(p), setGlobalZoom(z))
```

- No `vue` / `pinia` import in any `shell/*.service.ts` (file roles).
- `stop()` removes exactly the listeners `App.vue` removes today in `onBeforeUnmount` (1487-1521). Listeners never removed today stay unremoved — fixing leaks is a behavior change, parked for Wave 3.
- Remaining App.vue `invoke` sites (`capture_set_workspace`, `rest_set_workspace`, `spellcheck_init`, `ai_has_key`) switch to ports in place.

**Test surface**

```yaml
tests:
  unit:
    location: "app/src/shell/*.service.test.ts"
    coverage:
      - "window: title format per platform (skips setTitle on macOS); wheel zoom clamps and steps; close-requested persists then force-closes"
      - "file-open: drained pending opens and ?path= call openPath in order; drag-drop splits images vs files"
      - "shortcuts: dispatchMenuAction maps each menu id to its dep call; Esc closes the topmost overlay first"
      - "session: persist calls tabs + tiles persist; init validates then syncs"
      - "updates: shows toast only when a newer version exists"
      - "stop(): every unlisten returned by start() runs once"
    new_helpers:
      - name: "fakePorts"
        signature: "(overrides?: Partial<ShellPorts>) => ShellPorts & { calls: string[] }"
        file: "app/src/shell/fake-ports.ts"
```

**Seams**: (1) five services + tests in parallel, no caller; (2) `App.vue` wiring + port swaps for its last `invoke`s + `shell/CLAUDE.md` + baseline.

---

### PR-10 — Integrate gate

| Change | File |
|---|---|
| `raw-ipc` matches any `@tauri-apps/` specifier (not only `api/core`); message points to `platform/` | `app/arch/raw-ipc.rule.ts` + test |
| `rawIpc: []` | `app/arch/baseline.json` (via `arch:rebaseline`) |
| `libPurity` shrinks for every migrated `lib/` file | same |
| `arch/CLAUDE.md` rule row; root `CLAUDE.md` untouched (Invariant 3 already says it) | docs |
| `app/CLAUDE.md` map: `platform/`, `shell/` exist | docs |
| `pnpm --dir app full` green on macOS; push; CI green | — |

---

### Observability

| Log point | Level | Context |
|---|---|---|
| Result/args fail schema (report mode, dev only) | `console.warn` | `[platform:drift] <cmd> <args|result>: <first issue path + message>` |

No metrics, no audit (desktop app).

### Migration safety

No persisted data changes. Rollback = revert the PR's commits; every PR is independent of its siblings.

### Conventions check

**Honored**
- File roles `.port.ts` / `.adapter.ts` / `.service.ts` / `.test.ts` and `<port>.<target>.adapter.ts` naming (`docs/conventions/file-roles.md` §Roles, §Naming)
- Zod for boundary schemas (`app/src/lib/theme/schema.ts`)
- Only `platform/` imports `@tauri-apps/*` (root `CLAUDE.md` Invariant 3)
- Ratchet baseline only shrinks; moved keys renamed by hand (`app/arch/CLAUDE.md` §Moving)
- Co-located `*.test.ts`, `.ts` import extensions (`app/CLAUDE.md` §Tests)
- Doc sync: `platform/CLAUDE.md`, `shell/CLAUDE.md` added with their code (Invariant 6)

<conventions-check explicit_deviations="0" implicit_deviations="2">
- (implicit) `app/src/platform/ipc/catalog-contract.ts` — non-test helper with no role suffix, against file-roles "a file with no clear single role is a sign to split it". Rationale: shared test helper, same as `app/arch/fixture-tree.ts`.
- (implicit) `lib/cm-image-paste.ts`, `lib/image-resolve.ts`, `lib/saf-fs.ts` etc. import `platform/` — HLD §3 says `lib/` has "no IPC". Rationale: R8, moved to `features/` in Wave 2.
</conventions-check>

### As shipped

| Item | Planned | Shipped |
|---|---|---|
| Raw IPC | `rawIpc` 59 → 0 | 59 → 0; `raw-ipc` rule bans every `@tauri-apps/*` import outside `platform/` (`0c3db444`) |
| `App.vue` | ≤ 2100 lines | 2511 → 2005; five `shell/` services with per-step methods so `onMounted` order is unchanged |
| `libPurity` | shrinks | 21 → 5 |
| Unit tests | never drop | 1153 → 1354 (+ 40 arch) |
| Ports | 18 | 18 + `git-pane` adapter; `pathPort.convertFileSrc` added in PR-2 (`api/core` sync helper missed by the inventory) |
| File tree | §PR-1 tree | `ipc/catalog-fixtures.ts` instead of `catalog-contract.ts`; `ai-tools/`, `capture/`, `android/`, `cloud/`, `convert/` as own dirs; `plugin-fs` folded into `path/` |
| R11 | git-pane via the IPC gateway | Adapter takes raw `invoke` + `listen` (no drift validation); its own `ensure` validators check results |
| Inventory | 59 files | +1: `stores/savedViews.ts` (a literal NUL sentinel made `grep` skip it) — migrated in PR-7 |
| Gate | `full` green | Also fixed a stale Rust test (`read_file_test`, stale since `620418be`) unrelated to Wave 1 |

### Parked for Wave 2+

- `lib/` files that do IPC through ports → `features/<f>/internal/` (Wave 2).
- Flip proven domains from `report` to `strict` validation (Wave 3, new ADR).
- Rust commands regrouped by domain mirroring `platform/` (Wave 3, `commands.rs` split).
- `PlatformUnsupportedError` + `snakeToCamel` out of `ipc/command.port.ts` (port-file role).
- Direct `lib/` purity: `lib/` → `platform/index.ts` still pulls `@tauri-apps/*` transitively.
- Local `DirEntry` types duplicating port types (`useFolderTreeScan`, `useMindmapFolderFiles`); `githubSync` `guarded(cmd, …)` repeats the command string.
- Tests: Android paths in `file-open.service`; dev-only per-element parse of byte arrays (`fs` port).
- Behavior fixes deliberately not taken in a no-behavior-change wave: `directive-completions.ts` lets a Rust `null` default through (`key=null` snippets); cloud provider `icloud` vs Rust `i_cloud`; listeners `App.vue` never removed (still never removed).

---

### LLD AI Context YAML

```yaml
lld_version: v1.1
feature: "Wave 1 — Platform seam"
hld_version: v3.1
status: done
pr_count: 10
execution_order: [pr-1, [pr-2, pr-3, pr-4, pr-5, pr-6, pr-7, pr-8, pr-9], pr-10]
open_items: []
conventions_check:
  explicit_deviations: 0
  implicit_deviations: 2
dev_ready: true
```
