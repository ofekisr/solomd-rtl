## LLD: Wave 2 — Editor core

**Status**: Stable | **Version**: v1.0 | **Date**: 30-10-26 | **HLD**: `2026-10-30-wave-refactor-hld.md` v3.2 | **ADR**: [0004](../adr/0004-editor-feature-registry.md) | **Follows**: [Wave 1](2026-10-30-wave1-platform-lld.md), [Wave 1b](2026-10-30-wave1b-app-host-lld.md)

Wave 2 turns `components/Editor.vue` into a host under 400 lines that composes registered editor features, moves the Windows plain-textarea engine into its own component, and splits `lib/cm-live-blocks.ts`. Behavior does not change.

### Baseline (measured 30-10-26, `grep -a`)

| Fact | Value | Source |
|---|---|---|
| `Editor.vue` | 5024 lines: script 4264 (plain engine ≈ 2600), template 252, style 504 (plain ≈ 470) | `wc -l`, section greps |
| `cm-live-blocks.ts` | 1620 lines; `buildBlockDecorations` 978–1320, widgets 215–880, theme 1453–1620 | `grep -an` |
| CM path | 30 extension positions, 18 `Compartment`s, 20 `watch` calls, 13 exposed methods | `Editor.vue` 199–224, 3026–3145, 3668–3985, 4250 |
| `lib/` → `platform/` importers | 16 files | `grep -arl "platform/index" src/lib` excl. tests |
| Arch baseline | `fileSize` 70, `rawIpc` 0, `libPurity` 5 | `app/arch/baseline.json` |
| Unit tests | 1364 + 40 arch | `pnpm --dir app guard` |
| `guard` time | 17.2 s | `time pnpm --dir app guard` |

### Rulings

Decided without the user (yolo). Each is final for Wave 2.

| # | Question | Ruling | Why |
|---|---|---|---|
| E1 | Contract shape | `EditorFeature` = `id`, `settingsKeys`, `i18nKeys`, `extensions` by slot, reconfigurable `slots`, `watches`, `commands`, `setup`/`onMount`/`onTabSwitch`/`onUnmount` (ADR 0004) | Covers every pattern in today's `Editor.vue`: static extensions, compartment + watcher pairs, side-effect watchers, window listeners, mount/tab-switch work |
| E2 | Extension order | `EXTENSION_SLOTS`: 30 named positions in today's order; registry sorts by slot rank then registration order; golden test | CM precedence is positional; reordering is a behavior change |
| E3 | Reconfigure | One watcher in `useEditorFeatures`, shallow-compares each slot's `deps`, reconfigures all changed slots in one transaction | Today's language watcher reconfigures three compartments in one dispatch; per-slot watchers would split it |
| E4 | Features import Vue? | No. Features read a getter-only `EditorFeatureContext`; only `features/editor/internal/use*.ts` and `.vue` files import `vue` | Node tests on `EditorState`; same rule as `shell/` services |
| E5 | Registration order | `shell/editor-registry.service.ts` lists feature factories (one instance per editor, so split panes never share state); list order = lifecycle-hook order | HLD §3: `shell/` is the source of truth for registration order |
| E6 | Plain engine | One engine, not pluggable: `features/editor/ui/PlainEditor.vue` + children + `internal/plain/*`; its find, folds, autocomplete stay inside it | Its block model couples them; making them pluggable is a redesign, not an extraction |
| E7 | Two engines, one API | `EditorApi` (the 13 exposed methods) in contracts; `PlainEditor` and the CM side each implement it; `Editor.vue` forwards | Every exposed method today branches on `usePlainWindowsEditor` |
| E8 | Per-engine branches | Split, never merged: plain branch → `PlainEditor`, CM branch → feature command. Shared pure logic (table span, `formatMath`, image-src rewrite) → one `.ts` used by both | Merging branches changes behavior (history, focus, scroll differ) |
| E9 | HLD feature list | `find`, `spellcheck`, `vim`, `image-upload`, `folds`, `ai-rewrite`, `session` as listed; `export` has no code in `Editor.vue` (only citation loading, which is `completion`) → no `export` feature in Wave 2; added `completion`, `focus-mode`, `format`, `context-menu`, and editor core features `core`, `appearance`, `live-render` | Matches the code that exists |
| E10 | `ai-rewrite` shim | `features/ai-rewrite/internal/ai-rewrite.legacy.adapter.ts` wraps `lib/cm-ai-rewrite` + `lib/ai-activity` behind `AiRewritePort`; deleted in Wave 4 | HLD Wave 2 row |
| E11 | `lib/` files that do IPC (Wave 1 parked) | Move the editor-owned ones: `cm-spellcheck`, `cm-spellcheck-theme` → `spellcheck/internal`; `cm-image-paste`, `image-upload` → `image-upload/internal`. Park the rest (shared renderers, app-wide, settings, theme, git) for Wave 3 | Their owners are Wave 3 areas; moving them now couples this wave to Settings/shell |
| E12 | `libPurity` | Also move `cm-find-panel` → `find/internal`, `table-editor-bus`, `formula-editor-bus` → `format/internal` (5 → 2). `ai-activity` (AI wave) and `quick-capture-status` (capture, Wave 3) parked | Editor-owned only |
| E13 | Cross-feature imports | Each feature exposes `contracts/index.ts`; outside code imports only that | File roles §Feature folder |
| E14 | Where moved Vue files go | `Editor.vue`, `EditorContextMenu.vue` → `features/editor/ui/`, `features/context-menu/ui/`; `PaneContent.vue`, `Preview.vue` import them through contracts | HLD: move into `features/` as each wave touches a file |
| E15 | Styles | Component CSS moves with the component as a co-located `.css` loaded by `<style scoped src>` when the `.vue` would exceed 500 lines | Scoping unchanged; arch ratchet counts `.ts/.vue` only |
| E16 | i18n keys | Features declare keys (`i18nKeys`); a test checks each exists in `i18n/en.ts`. Locale tables do not move | Moving 10+ locale tables is churn with no behavior; Wave 3 can split them with settings slices |
| E17 | Settings slice | Features declare `settingsKeys`; a test checks each is a settings-store key. Schema + migration is Wave 3 | HLD Wave 3 row |
| E18 | New lint rule | None. Gate = ratchet (`Editor.vue`, `cm-live-blocks.ts` leave `fileSize`) + registry contract tests | `feature-boundary` already guards `internal/`; no new violation class |
| E19 | Characterization first | Every feature PR: test the CM extension / command against today's behavior on `EditorState` (Node) before wiring; commands take `ViewLike = { state, dispatch, focus }` | Prompt constraint; no DOM in Node |
| E20 | Parallel safety | Layer-2 PRs own disjoint files and never edit `Editor.vue` except PR-2; wiring happens in PR-8, one feature per seam | One shared checkout |
| E21 | Behavior fixes | None. Known oddities found while moving go to "Parked" | No-behavior-change wave |
| E22 | Worker models | Implementers Sonnet; layer reviews Sonnet; final PR review Opus; read-only Haiku | User instruction |
| E23 | Browser check | After each PR: `solomd-web-alt` (:1430), open a markdown tab, type, toggle live edit/source, Cmd+F, fold, no console errors | Prompt constraint |

---

### PR graph

```yaml
prs:
  - id: pr-1
    name: "feat(editor): EditorFeature contract, registry, host composable (no callers)"
    depends_on: []
    location: "app/src/features/editor/{contracts,internal}, app/src/shell/editor-registry.service.ts, docs/adr/0004"
  - id: pr-2
    name: "refactor(editor): plain-textarea engine → PlainEditor"
    depends_on: [pr-1]
    parallel_with: [pr-3, pr-4, pr-5, pr-6, pr-7]
    location: "components/Editor.vue (owner), features/editor/ui/Plain*.vue, features/editor/internal/plain/"
  - id: pr-3
    name: "refactor(live-blocks): split cm-live-blocks.ts"
    depends_on: []
    location: "lib/cm-live-blocks.ts, lib/live-blocks/"
  - id: pr-4
    name: "feat(editor): find, spellcheck, vim, focus-mode features"
    depends_on: [pr-1]
  - id: pr-5
    name: "feat(editor): image-upload, folds, session features"
    depends_on: [pr-1]
  - id: pr-6
    name: "feat(editor): completion, ai-rewrite features"
    depends_on: [pr-1]
  - id: pr-7
    name: "feat(editor): core, appearance, live-render, format, context-menu"
    depends_on: [pr-1]
  - id: pr-8
    name: "refactor(editor): integrate — Editor.vue host composes the registry"
    depends_on: [pr-2, pr-3, pr-4, pr-5, pr-6, pr-7]
execution_order: [pr-1, [pr-2, pr-3, pr-4, pr-5, pr-6, pr-7], pr-8]
```

Plans: `docs/plans/wave-refactor/wave2/2026-10-30-wave2-pr<N>-<slug>.md`, one per PR.

---

### PR-1 — Contracts

**Pattern**: Plugin registry (microkernel) — host owns lifecycle, plugins contribute data (`sdlc-dev` §patterns); ordered slots replace positional arrays. Port + Zod per file roles (`docs/conventions/file-roles.md` §Roles `.port.ts`). Precedent for injected getters: `shell/*.service.ts` deps (Wave 1 R9).

**File tree**

```
app/src/features/editor/
├── CLAUDE.md                              # host, engines, how to add a feature / slot
├── contracts/
│   ├── editor-feature.port.ts             # EditorFeature, EditorFeatureContext, ReconfigurableSlot, FeatureWatch, ViewLike, EXTENSION_SLOTS, manifest Zod
│   ├── editor-api.port.ts                 # EditorApi (13 methods), DocAccess
│   └── index.ts                           # public surface
├── internal/
│   ├── editor-feature-registry.service.ts # createEditorFeatureRegistry(features)
│   ├── useEditorFeatures.ts               # Vue: compartments, single reconfigure watcher, watches, lifecycle fan-out
│   ├── cm-probe.ts                        # test helper: stateWith / fakeView
│   └── *.test.ts
app/src/shell/editor-registry.service.ts    # ordered feature list → registry (empty list in PR-1)
```

**Contracts (shapes, not code)**

```typescript
// editor-feature.port.ts
EXTENSION_SLOTS = ['ime-guard','history','direction','drag-aware','cursor','active-line','selection-tools',
  'search','keymap','line-numbers','wrap','language','rich','theme','vim','font','spellcheck-attr','ai-lock',
  'focus','typewriter','image-paste','md-completion','ai-key','md-spellcheck','slash','task-list','fold',
  'session','stable-click','update-listener'] as const      // today's buildExtensions() order
type ExtensionSlot = typeof EXTENSION_SLOTS[number]
type ViewLike = Pick<EditorView, 'state' | 'dispatch' | 'focus'>
interface EditorFeatureContext {
  tab(): Tab; props(): { focusMode: boolean; typewriterMode: boolean; spellCheck: boolean }
  settings: SettingsStore            // type-only import; features read only their declared keys
  themeMode(): 'light' | 'dark'; t(key: string, params?: Record<string, unknown>): string
  setContent(tabId: string, text: string): void; findTab(id: string): Tab | undefined; activeTabId(): string | null
  toast: { info(m: string): void; success(m: string): void; error(m: string): void }
  view(): EditorView | null; run(command: string, ...args: unknown[]): unknown; citations(): CitationEntry[]
}
interface ReconfigurableSlot { slot: ExtensionSlot; deps(ctx): unknown; build(ctx): Extension; when?(ctx): boolean; after?(ctx, view): void }
interface FeatureWatch { deps(ctx): unknown; run(ctx, view: EditorView | null): void }
interface EditorFeature {
  id: string; settingsKeys: readonly string[]; i18nKeys: readonly string[]
  extensions?: Partial<Record<ExtensionSlot, (ctx) => Extension>>
  slots?: readonly ReconfigurableSlot[]; watches?: readonly FeatureWatch[]
  commands?: Record<string, (ctx, ...args: never[]) => unknown>
  setup?(ctx): void | (() => void)                       // per editor instance; returns cleanup
  onMount?(ctx, view): void; beforeTabSwitch?(ctx, view, ids): void; onTabSwitch?(ctx, view, ids: { oldId?: string; newId: string }): void; onUnmount?(ctx, view): void
}
EditorFeatureManifestSchema = z.object({ id: kebab, settingsKeys: z.array(z.string()), i18nKeys: z.array(z.string()) })

// editor-api.port.ts
interface EditorApi { getLineSelection; gotoLine; insertImageFromPath; insertImageUrl; uploadLocalImages; getViewLine;
  scrollToLine; lineTopY; insertMarkdown; openFind; applyFold; openTableAtCursor; openFormulaAtCursor }  // today's signatures
interface DocAccess { getDoc(): string; getCaret(): number; replaceRange(from: number, to: number, text: string): void }

// editor-feature-registry.service.ts
createEditorFeatureRegistry(features: EditorFeature[]): {
  features; extensions(ctx, compartmentFor: (slotKey) => Compartment): Extension[]   // slot rank, then registration order
  slots: Array<{ key: string; spec: ReconfigurableSlot }>; watches; command(name): fn  // throws on unknown
}  // throws on: duplicate id, duplicate command, manifest fails Zod

// useEditorFeatures.ts
useEditorFeatures(registry, ctx): { extensions(): Extension[]; run(name, ...args); mount(view); switchTab(view, ids); unmount(view) }
  // one watch over all slot deps (shallow compare) → one dispatch of every changed reconfigure, then each changed slot's after()
  // watches[] → one Vue watch each; setup() on creation, cleanup on scope dispose
```

**Test surface**

```yaml
tests:
  unit:
    location: "app/src/features/editor/**/*.test.ts"
    coverage:
      - "registry: emits extensions in EXTENSION_SLOTS rank, ties in registration order (golden list)"
      - "registry: duplicate id / duplicate command / bad manifest throw"
      - "registry: slot with when()=false contributes nothing"
      - "useEditorFeatures: two slots changing in one tick → one dispatch with two reconfigure effects; after() runs once each"
      - "useEditorFeatures: unchanged deps → no dispatch; null view → no throw"
      - "useEditorFeatures: setup cleanup runs on scope stop"
    new_helpers:
      - name: "stateWith"
        signature: "(extensions: Extension, doc?: string, selection?: { anchor: number; head?: number }) => EditorState"
        file: "app/src/features/editor/internal/cm-probe.ts"
      - name: "fakeView"
        signature: "(state: EditorState) => ViewLike & { dispatched: TransactionSpec[]; focused: number }"
        file: "app/src/features/editor/internal/cm-probe.ts"
      - name: "fakeContext"
        signature: "(overrides?: Partial<EditorFeatureContext> & { settings?: Record<string, unknown> }) => EditorFeatureContext"
        file: "app/src/features/editor/internal/cm-probe.ts"
```

**Seams**: (1) port + manifest schema + `cm-probe`; (2) registry service + tests; (3) `useEditorFeatures` + tests; (4) `shell/editor-registry.service.ts` (empty list), `features/editor/CLAUDE.md`, ADR 0004, `app/CLAUDE.md` map row.

---

### PR-2 — Plain engine → `PlainEditor`

**Pattern**: Extract Component + Extract Composable (Vue); shared state via `createPlainState()` passed to composables (Wave 1b B2 precedent `createX`/`useX`).

**What moves** (from `Editor.vue` at `dcb2ad77`)

| Target | Contents (Editor.vue lines) |
|---|---|
| `internal/plain/plain-blocks.ts` (pure) | `PlainBlock`, `splitPlainMarkdownBlocks` 732–872, `plainTocFingerprint` 542, `mapRenderedPrefixToSource` 2354, `computePlainTabEdit` 1994, `computeSmartEnter` 2136 |
| `internal/plain/usePlainState.ts` | refs 331–347, `plainLiveEnabled`, `plainEditorStyle`, history 1344–1415, content sync helpers 1260–1343 |
| `internal/plain/usePlainGutter.ts` | 359–448, 873–956 (line heights, gutter, line tops) |
| `internal/plain/usePlainFolds.ts` | 449–523 |
| `internal/plain/usePlainRender.ts` | `plainBlocks` 524, `renderPlainBlock` 553, `processPlainLiveRenderedBlocks` 589–724, code copy 725 |
| `internal/plain/usePlainOverlays.ts` | focus mode / solid caret 988–1151, typewriter 957–987 |
| `internal/plain/usePlainFind.ts` | 1416–1801 |
| `internal/plain/usePlainAutocomplete.ts` | 1802–1993 |
| `internal/plain/usePlainKeys.ts` | 2031–2353 keydown paths, select-all 2615–2643, 2792–2816 |
| `internal/plain/usePlainBlockEditing.ts` | 2401–2614, 2817–2887 |
| `internal/plain/usePlainContextMenu.ts` | plain branch of 2651–2784 |
| `ui/PlainEditor.vue` | plain template 4273–4507 minus find bar + popup; plain branches of every `EditorApi` method; plain `onMounted`/tab-switch/unmount work; plain branch of transform-case / format / table / formula / fold / session |
| `ui/PlainFindBar.vue`, `ui/PlainAutocomplete.vue` | template 4443–4506 + their CSS |
| `ui/plain-editor.css` etc. | style 4550–5024 split per component |

`Editor.vue` after PR-2: `<PlainEditor v-else ref="plainRef" …>`; every exposed method's plain branch becomes `plainRef.value?.<method>()`. Plain-only listeners (`focusin`, window blur/focus, transform-case/format for the plain path) register inside `PlainEditor`. Expected `Editor.vue` ≈ 1500 lines.

**Test surface**

```yaml
tests:
  unit:
    location: "app/src/features/editor/internal/plain/*.test.ts"
    coverage:
      - "characterize BEFORE moving: splitPlainMarkdownBlocks (fences, blank lines, headings, trailing newline), computePlainTabEdit (indent/outdent, list), computeSmartEnter (list continuation), mapRenderedPrefixToSource, plainTocFingerprint"
      - "plain find: match list for case / no-case, replace-all result string (pure search fn extracted)"
      - "plain autocomplete: buildAcItems per trigger kind (pure)"
```

**Seams**: (1) pure helpers + characterization tests, `Editor.vue` imports them; (2) composables, `Editor.vue` still owns template; (3) `PlainEditor.vue` + children + CSS, `Editor.vue` delegates; browser check with `?forcePlain`.

---

### PR-3 — `cm-live-blocks.ts` split

**Pattern**: Split module by responsibility; entry file keeps the public exports (`liveBlocksExtension`, `liveBlocksTheme`, `extractImageRoot`) so importers do not change.

```
app/src/lib/live-blocks/
├── diagram-cache.ts      # mermaid + graphviz caches/inflight (86–144)
├── layout.ts             # image heights, relayout timer/effect (38, 177–214)
├── widgets.ts            # Image, Table, HtmlBlock, Math, InlineMath (215–442)
├── diagram-widgets.ts    # Mermaid, Graphviz, Plantuml + diagramWidget (443–581, 920–975)
├── mindmap-widget.ts     # 582–717
├── tldraw-widget.ts      # 718–879
├── decorations.ts        # BlockOptions, buildBlockDecorations (880, 976–1319), split if > 400
└── theme.ts              # liveBlocksTheme (1453–1620)
app/src/lib/cm-live-blocks.ts   # liveBlocksExtension + re-exports, ≤ 400
```

**Test surface**: characterize first on `EditorState.create({ extensions: liveBlocksExtension(opts) })` — decoration kinds/ranges for: image line, GFM table, `$$` math, inline math, mermaid/dot/plantuml fences, mindmap fence, tldraw fence, HTML block; cursor inside a block keeps source; `keepSource()` true keeps all source. Existing `cm-live-*` tests stay green.

**Seams**: (1) characterization tests on the current file; (2) leaf moves (cache, layout, widgets…) one per commit; (3) entry ≤ 400, `fileSize` entry dropped.

---

### PR-4…PR-7 — Feature modules (parallel, new files only)

**Pattern**: each feature = `contracts/<f>.feature.ts` (the `EditorFeature`) + `contracts/index.ts` + `internal/` (commands, pure helpers) + `CLAUDE.md`. Code is copied verbatim from the CM branch of `Editor.vue` and pinned by characterization tests; `Editor.vue` keeps its copy until PR-8 swaps it. Features import today's `lib/` modules in place (moves happen in PR-8).

| PR | Feature | Slots / extensions | Commands, watches, hooks | From `Editor.vue` |
|---|---|---|---|---|
| 4 | `find` | `search`: `search({top, createPanel})` + `incrementalFindScroll` | `openFind` | 95–125, 3056–3057, 3385–3394 |
| 4 | `spellcheck` | `spellcheck-attr`* (`props.spellCheck`); `md-spellcheck` | — | 2912, 3077, 3108–3109, 3779 |
| 4 | `vim` | `vim`* (`settings.vimMode`) | `setup`: `Vim.defineEx` once (global guard kept) | 226–259, 3075, 3848 |
| 4 | `focus-mode` | `focus`*, `typewriter`* | — | 3079–3080, 3788–3806 |
| 5 | `image-upload` | `image-paste` | `insertImageFromPath`, `insertImageUrl`, `uploadLocalImages`; pure `parseFrontMatterImageRoot`, `imageSrcChanges` | 161–180, 3081, 4010–4121 |
| 5 | `folds` | `fold`* (`settings.foldingEnabled`) | `applyFold` (CM branch); `onMount`/`onTabSwitch`/`onUnmount` save/restore via `fold-memory` | 2916–2924, 3114, 3522–3568 (CM), 3608–3628 (CM), 3895 |
| 5 | `session` | `session` | `onMount`/`onTabSwitch`: restore (CM branch); watch clean-save → `clearSession` | 3115, 3147–3170 (CM), 3751 |
| 6 | `completion` | `md-completion`; `slash`* | `setup`: load citations; watch `workspaceBibliography` | 181–190, 2888–2902, 3084–3106, 3110, 3978 |
| 6 | `ai-rewrite` | `ai-lock`* (`isAiWorking`); `ai-key`* (`when`: not App Store, markdown) | `AiRewritePort` + legacy adapter (E10) | 2905–2910, 3078, 3107, 3760–3777 |
| 7 | `editor` core (`internal/core/*.feature.ts`) | `core`: `ime-guard`, `history`, `drag-aware`, `cursor`*, `active-line`*, `selection-tools`, `keymap`, `line-numbers`*, `wrap`*, `task-list`, `stable-click`; `appearance`: `direction`*, `language`* (`after`: lazy language), `theme`* (`after`: `solomd:cm-relayout`), `font`*; `live-render`: `rich`* | `live-render.setup`: `setLiveEditCopyLabel`; watch PlantUML → relayout | 199–224, 2926–3076, 3113–3118, 3838–3946 (CM parts) |
| 7 | `format` | — | `transformCase`, `formatMarkdown` (CM branch), `openTableAtCursor`, `openFormulaAtCursor` (shared via `DocAccess`), `insertMarkdown`; pure `tableRangeAt`, `formatMath` | 3261–3283, 3327–3345, 3403–3513, 4226–4248 |
| 7 | `context-menu` | — | `useCmContextMenu` (Vue, CM branch of 2651–2784); `readClipboard`/`writeClipboard` for both engines | 2644–2784 |

(* = reconfigurable slot)

**Test surface** (each feature)

```yaml
tests:
  unit:
    location: "app/src/features/<f>/**/*.test.ts"
    coverage:
      - "manifest: id, settingsKeys exist on settings defaults, i18nKeys exist in i18n/en.ts"
      - "each slot: build(ctx) for each deps value matches today (facet/field probe on EditorState: e.g. contentAttributes spellcheck true/false; readOnly when AI-locked; lineNumbers present/absent)"
      - "each command on fakeView: same transaction as today's code (changes, selection, userEvent, scrollIntoView) and focus() called"
      - "format: transformCase cycle on word under caret / selection; formatMarkdown bold/heading via lib/md-format; insertMarkdown $|$ marker and leading-newline rule"
      - "image-upload: imageSrcChanges replaces every ](src) with encoded URL; parseFrontMatterImageRoot keys imageRoot/image_root/typora-root-url"
      - "folds: applyFold toggle/all/none/level on a heading doc; disabled → toast fold.disabledHint"
      - "vim: :w → solomd:menu-action file.save; :q → file.closeTab; defineEx registered once across two setups"
      - "core: EXTENSION_SLOTS golden list equals the order of today's buildExtensions()"
    reuse_helpers:
      - "features/editor/internal/cm-probe.ts :: stateWith, fakeView, fakeContext"
```

**Seams**: one seam per feature (folder + tests + `CLAUDE.md`); closing seam registers the PR's feature factories in `shell/editor-registry.service.ts` (list order = lifecycle-hook order: `core`, `appearance`, `live-render`, `find`, `vim`, `spellcheck`, `ai-rewrite`, `focus-mode`, `image-upload`, `completion`, `session`, `folds`, `format` — session before folds, as today's `maybeRestoreSession` → `restoreFolds`) — still no caller.

---

### PR-8 — Integrate

| Seam | Change |
|---|---|
| 1 | `Editor.vue` CM path: `useEditorFeatures(createEditorRegistry(), ctx)`; delete `buildExtensions`, 18 compartments, slot watchers; `useCmView` (create/destroy, content sync + flush, relayout, dev expose) and `useCmTabSwitch` (caret memory #144/#169) in `features/editor/internal/`; `cm-api.ts` (gotoLine, getViewLine, lineTopY, scrollToLine, getLineSelection) |
| 2 | Exposed API: `Editor.vue` builds the CM `EditorApi` from feature commands + `cm-api`; forwards to `PlainEditor` on the plain engine |
| 3 | `git mv`: `components/Editor.vue` → `features/editor/ui/Editor.vue`; `EditorContextMenu.vue` → `features/context-menu/ui/`; `PaneContent.vue`, `Preview.vue` import via contracts |
| 4 | `git mv` lib files (E11, E12) into features; importers use `contracts/index.ts`; `fileSize`/`libPurity` keys renamed then rebaselined |
| 5 | `Editor.vue` < 400 lines; `arch:rebaseline` (drops `Editor.vue`, `cm-live-blocks.ts`); `features/*/CLAUDE.md`, `app/CLAUDE.md` map (`features/` exists), HLD status; `full`; push; CI green |

**Test surface**: registry golden order with every feature registered; `features/editor` integration test: `createEditorRegistry().extensions(fakeContext())` builds an `EditorState` without throwing for markdown and for `ts`; e2e 14/14; browser check (E23) on CM and `?forcePlain`.

---

### Observability

No new log points. Existing `console.error('[Editor] uploadLocalImages failed …')` keeps its text. No metrics, no audit (desktop app).

### Migration safety

No persisted data changes. `fold-memory`, `cm-session-restore` keys unchanged. Rollback = revert the PR's commits; layer-2 PRs add files only (except PR-2/PR-3, which are self-contained).

### Conventions check

**Honored**
- Feature folder `contracts/ internal/ ui/ CLAUDE.md`; outside imports through `contracts/` (`docs/conventions/file-roles.md` §Feature folder)
- Roles `.port.ts`, `.service.ts`, `.feature.ts`, `.adapter.ts`, `.test.ts`; `<port>.<target>.adapter.ts` (`file-roles.md` §Roles, §Naming)
- Composables move with their feature, keep `useX.ts` (`app/CLAUDE.md` §Map, `composables/` row)
- No `vue`/`pinia` in `.service.ts` (`file-roles.md` §Roles); `shell/` owns registration order (HLD §3)
- Ratchets only shrink; moved keys renamed by hand (root `CLAUDE.md` Invariant 2, `app/arch/CLAUDE.md` §Moving)
- `.ts` extensions on local imports (`app/CLAUDE.md` §Tests); doc sync per feature `CLAUDE.md` (Invariant 6)

<conventions-check explicit_deviations="0" implicit_deviations="2">
- (implicit) `features/*/contracts/index.ts` — barrel with no role suffix, against `file-roles.md` §Naming "A file with no clear single role is a sign to split it". Rationale: the one public entry per feature that `contracts/`-only imports need.
- (implicit) `features/editor/internal/cm-probe.ts` — non-test helper with no role suffix, against the same rule. Rationale: shared test helper, precedent `app/arch/fixture-tree.ts`, `shell/fake-ports.ts`.
</conventions-check>

### As shipped

Commits `edbc7255..HEAD` on `main` (12 commits, 30-10-26).

| Fact | Before | After |
|---|---|---|
| `Editor.vue` | 5024 lines in `components/` | 188 lines in `features/editor/ui/` |
| `cm-live-blocks.ts` | 1620 | 170 (rest in `lib/live-blocks/`) |
| `libPurity` baseline | 5 | 2 (`ai-activity`, `quick-capture-status`) |
| `fileSize` baseline | 70 | 68 |
| Features | none | 12 under `features/` (13 registry entries: core, appearance, live-render + 10) |

Where moved files landed:

| From | To |
|---|---|
| `components/Editor.vue` | `features/editor/ui/Editor.vue` |
| `components/EditorContextMenu.vue` | `features/context-menu/ui/` |
| `lib/cm-find-panel` | `features/find/internal/` |
| `lib/cm-spellcheck`, `cm-spellcheck-theme` | `features/spellcheck/internal/` |
| `lib/cm-image-paste`, `image-upload` | `features/image-upload/internal/` |
| `lib/table-editor-bus`, `formula-editor-bus` | `features/format/internal/` |
| Plain engine (was in `Editor.vue`) | `features/editor/ui/PlainEditor.vue` + `internal/plain/` |

Deviations from the plan:
- `Editor.vue` moved in PR-2 (not PR-8 Task 3): `components/` cannot import `features/editor/internal`.
- `ctx.reconfigure(slotKey, ext)` added: lazy language loading reconfigures its own compartment.
- Global Node test loader (`app/scripts/node-test-loader.mjs`) replaced per-feature loaders.
- Cross-feature users of moved files import through contracts (re-exports in `image-upload`, `format`, `context-menu-component.ts`).

### Parked for Wave 3+

- `Editor.vue` imports `createEditorRegistry` from `shell/` (feature -> shell edge). Inject a factory instead.
- Features purity ratchet: `find/internal/cm-find-panel.ts` and `format/internal/{table,formula}-editor-bus.ts` import `vue`/`pinia`; leaving `lib/` dropped them from `libPurity`. Add a `featurePurity` baseline or move them to `ui/`.
- Tests in other features import `editor/internal/cm-probe.ts` (arch exempts tests); expose it as `contracts/testkit.ts`.
- Per-feature settings slices: features declare `settingsKeys`, the store is still one `settings.ts` (E17).
- i18n keys into features: features declare `i18nKeys`, tables stay in `i18n/` (E16).
- `libPurity`: `lib/ai-activity.ts` (Wave 4), `lib/quick-capture-status.ts` (Wave 3).
- `ai-rewrite.legacy.adapter.ts` shim: delete in Wave 4 (E10).
- `lib/` -> `platform/` files not owned by an editor feature (13): `code-copy`, `image-resolve`, `open-google-translate`, `docx-export`, `directive-completion-registry`, `telemetry`, `check-update`, `new-window`, `devtools`, `saf-fs`, `reveal-in-file-manager`, `theme/sources`, `git-pane/serviceFactory`.
- Plain engine features (find, folds, autocomplete) pluggable through `EditorFeature` (needs an ADR).
- Plain engine and `format` both handle `solomd:transform-case` / `solomd:format-markdown` (format bails on a null view); fold the plain transforms into `format` or guard double-handling.
- Contract gaps: `bind()` must precede mount (setups use neither `run` nor `reconfigure`); `buildState` does not distinguish ts vs md state in tests.
- Test gaps: `setup()` hooks, `incrementalFindScroll` listener, `openFind` with a view, `spellcheckEnabled` lazy read, `useCitations` (Vue + Pinia + IPC), live-blocks `arrowIntoBlock` keymap / `liveBlocksTheme` / relayout plugin, plain `buildAcItems` slash/fence branches, plain splitter edge branches.
- Settings-key check is a regex over feature source; replace with a typed key list.
- Carried from Wave 1: strict validation (Wave 3), `PlatformUnsupportedError` + `snakeToCamel` out of `command.port.ts`, behavior fixes (`key=null` snippets, `icloud`, never-removed listeners).

---

### LLD AI Context YAML

```yaml
lld_version: v1.0
feature: "Wave 2 — Editor core"
hld_version: v3.2
status: stable
pr_count: 8
execution_order: [pr-1, [pr-2, pr-3, pr-4, pr-5, pr-6, pr-7], pr-8]
open_items: []
conventions_check:
  explicit_deviations: 0
  implicit_deviations: 2
dev_ready: true
```
