# Mindmap Phase 7 — Views, Toolbar, Node Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every `.mmap` tab Map / Source / Outline views, a toolbar that exposes all existing map actions, a side panel that edits node formatting and map display through `mind-elixir` APIs, multi-select, and an XMind open path that never duplicates an existing `.mmap`.

**Architecture:** Pure logic lives in focused `src/lib` modules (view mode, XMind open resolution, map display, node field validation), each unit-tested with `node:test`. `MindmapView.vue` becomes a shell that owns the view mode, toolbar, side panel and a composite active-map handle; `MindmapCanvas.vue` exposes a small API (`run`, `getMind`, display override) and emits selection changes. Map display settings resolve as file override (`display` block in the `.mmap` envelope) over global defaults (`settings.mindmapDefaults`).

**Tech Stack:** Vue 3, Pinia, TypeScript, CodeMirror 6, Tauri 2 (Rust), `mind-elixir` 5.15.1, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-12-mindmap-phase7-views-panel-design.md`. Parent: `docs/superpowers/specs/2026-10-11-mindmap-design.md`.

## Global Constraints

- Branch `feat/mindmap-phase7`; no worktree; never push.
- pnpm in `app/`. Phase 7 adds no npm dependency.
- TypeScript: no `any`, no zod (plain type guards, as in `mindmap-format.ts`), constants for every literal value, functions ≤ ~20 lines, early returns, no comments except non-obvious "why".
- `src/lib` imports between lib files use the `.ts` extension (node test runner requirement).
- Unit tests: `cd app && node --test --experimental-strip-types src/lib/<file>.test.ts`.
- Build: `cd app && pnpm build` (runs `vue-tsc` + `vite build`) must pass at the end of every task that touches `.vue`, stores or composables.
- Rust tests: `cd app/src-tauri && cargo test fs_file_exists`.
- Known pre-existing failures, out of scope: 12 `src/lib/*.test.ts` files with extensionless imports; one Rust assertion in `detect_language_from_extension`.
- Every map payload passes through `sanitizeMindmapData` before it is rendered or exported. Node edits from the panel are validated before `reshapeNode`.
- Allowed links match `SAFE_LINK_PATTERN = /^(https?:|mailto:)/i` (`mindmap-format.ts`).
- Gate data lives in `node.metadata.gate`; never replace `metadata`, always merge.
- New user-facing strings go in `app/src/i18n/en.ts` (`mindmap.*`). Other locales fall back.
- Layout uses logical properties (`inset-inline-*`, `margin-inline-*`, `border-inline-*`) so RTL mirrors.
- No new default key bindings in Phase 7.
- Commit trailer: `Co-Authored-By: Claude <model> 5.5 <noreply@anthropic.com>` (use the implementer's model name).

## Spec deltas (decided while planning)

| Spec says | Plan does | Why |
|---|---|---|
| Top-level `solomd` block in the `.mmap` JSON | `display` block on the envelope (`{ format, version, data, display? }`) | The envelope is already SoloMD-specific; `data` stays pure Mind Elixir |
| Zod for the block | Plain type guards | Repo rule: no zod in `src/lib` |
| Add Focus / Unfocus to the context menu | Already shown by the package (`contextMenu.focus` defaults on); only add `mindmap.focusNode` / `mindmap.cancelFocus` commands | Avoid duplicate menu items |

## File Map

| File | Status | Responsibility |
|---|---|---|
| `app/src/lib/mindmap-view-mode.ts` (+ test) | Create | Mode type, normalization, cycling, source-exit guard, view action ids |
| `app/src/lib/mindmap-xmind-open.ts` (+ test) | Create | Decide activate / open existing `.mmap` / import for an `.xmind` path |
| `app/src/lib/mindmap-display.ts` (+ test) | Create | `MapDisplay` type, parse, resolve, font stacks, straight branch paths |
| `app/src/lib/mindmap-node-style.ts` (+ test) | Create | Panel field validators → `Partial<NodeObj>` patches; icon set |
| `app/src/lib/mindmap-format.ts` (+ test) | Modify | Envelope `display` read/write |
| `app/src/types.ts` | Modify | `Tab.mindmapMode` |
| `app/src/stores/settings.ts` | Modify | `mindmapDefaults`, `mindmapPanelOpen`, actions |
| `app/src-tauri/src/commands.rs`, `lib.rs`, `runner.rs` | Modify | `fs_file_exists` |
| `app/src/composables/useFiles.ts` | Modify | `openXmind` uses the resolver |
| `app/src/composables/useMindmapDisplay.ts` | Create | Apply a resolved `MapDisplay` to an instance |
| `app/src/components/MindmapView.vue` | Modify | Shell: modes, toolbar, panel, composite handle, view keys |
| `app/src/components/MindmapCanvas.vue` | Modify | Expose API, emit selection, display override, `registerActive` prop |
| `app/src/components/MindmapToolbar.vue` | Create | View switcher, undo/redo, panel toggle, overflow menu |
| `app/src/components/MindmapSidePanel.vue` | Create | Node / Map tabs container |
| `app/src/components/MindmapNodeFields.vue` | Create | Node tab fields |
| `app/src/components/MindmapMapFields.vue` | Create | Map tab fields (also used in Settings) |
| `app/src/components/SettingsPanel.vue` | Modify | Settings → Mindmap defaults section |
| `app/src/lib/keybindings.ts`, `app/src/i18n/en.ts` | Modify | New action ids, strings |

---

### Task 1: View-mode model and commands

**Files:**
- Create: `app/src/lib/mindmap-view-mode.ts`
- Test: `app/src/lib/mindmap-view-mode.test.ts`
- Modify: `app/src/types.ts` (Tab interface), `app/src/lib/keybindings.ts:209` (after `mindmap.findDuplicates`), `app/src/i18n/en.ts` (`mindmap` block near line 1355)

**Interfaces:**
- Produces:
  ```ts
  export type MindmapMode = 'map' | 'source' | 'outline';
  export const MINDMAP_MODES: readonly MindmapMode[];
  export const DEFAULT_MINDMAP_MODE: MindmapMode; // 'map'
  export const VIEW_ACTIONS: Readonly<Record<string, MindmapMode | 'cycle'>>;
  export function normalizeMindmapMode(value: unknown): MindmapMode;
  export function nextMindmapMode(mode: MindmapMode): MindmapMode;
  export function targetModeFor(actionId: string, current: MindmapMode): MindmapMode | null;
  export type SourceExit = { ok: true } | { ok: false; error: string };
  export function checkSourceExit(text: string, parse: (text: string) => { ok: true } | { ok: false; error: string }): SourceExit;
  ```
- `Tab.mindmapMode?: MindmapMode` (optional; read through `normalizeMindmapMode`).

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/mindmap-view-mode.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkSourceExit, nextMindmapMode, normalizeMindmapMode, targetModeFor } from './mindmap-view-mode.ts';

test('normalizeMindmapMode falls back to map for unknown values', () => {
  assert.equal(normalizeMindmapMode(undefined), 'map');
  assert.equal(normalizeMindmapMode('graph'), 'map');
  assert.equal(normalizeMindmapMode('source'), 'source');
});

test('nextMindmapMode cycles map → source → outline → map', () => {
  assert.equal(nextMindmapMode('map'), 'source');
  assert.equal(nextMindmapMode('source'), 'outline');
  assert.equal(nextMindmapMode('outline'), 'map');
});

test('targetModeFor maps view actions and ignores others', () => {
  assert.equal(targetModeFor('mindmap.viewOutline', 'map'), 'outline');
  assert.equal(targetModeFor('mindmap.cycleView', 'outline'), 'map');
  assert.equal(targetModeFor('mindmap.fit', 'map'), null);
});

test('checkSourceExit passes the parser error through', () => {
  const ok = checkSourceExit('{}', () => ({ ok: true }));
  const bad = checkSourceExit('{', () => ({ ok: false, error: 'Invalid JSON: x' }));
  assert.deepEqual(ok, { ok: true });
  assert.deepEqual(bad, { ok: false, error: 'Invalid JSON: x' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-view-mode.test.ts`
Expected: FAIL, cannot find module `./mindmap-view-mode.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/lib/mindmap-view-mode.ts
export type MindmapMode = 'map' | 'source' | 'outline';

export const MINDMAP_MODES: readonly MindmapMode[] = ['map', 'source', 'outline'];
export const DEFAULT_MINDMAP_MODE: MindmapMode = 'map';
const CYCLE = 'cycle';

export const VIEW_ACTIONS: Readonly<Record<string, MindmapMode | typeof CYCLE>> = {
  'mindmap.viewMap': 'map',
  'mindmap.viewSource': 'source',
  'mindmap.viewOutline': 'outline',
  'mindmap.cycleView': CYCLE,
};

export function normalizeMindmapMode(value: unknown): MindmapMode {
  return MINDMAP_MODES.includes(value as MindmapMode) ? (value as MindmapMode) : DEFAULT_MINDMAP_MODE;
}

export function nextMindmapMode(mode: MindmapMode): MindmapMode {
  const index = MINDMAP_MODES.indexOf(mode);
  return MINDMAP_MODES[(index + 1) % MINDMAP_MODES.length];
}

export function targetModeFor(actionId: string, current: MindmapMode): MindmapMode | null {
  const target = VIEW_ACTIONS[actionId];
  if (target === undefined) return null;
  return target === CYCLE ? nextMindmapMode(current) : target;
}

export type SourceExit = { ok: true } | { ok: false; error: string };
type ParseOutcome = { ok: true } | { ok: false; error: string };

export function checkSourceExit(text: string, parse: (text: string) => ParseOutcome): SourceExit {
  const result = parse(text);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-view-mode.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Add the tab field, actions and strings**

In `app/src/types.ts`, inside `interface Tab` after `importedFrom`:

```ts
  /** Mindmap tabs only: which renderer shows the file. Read through
   *  `normalizeMindmapMode`; older sessions have no value. */
  mindmapMode?: 'map' | 'source' | 'outline';
```

In `app/src/lib/keybindings.ts`, after the `mindmap.findDuplicates` entry:

```ts
  { id: 'mindmap.viewMap', label: 'Mindmap: Map View', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.viewSource', label: 'Mindmap: Source View', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.viewOutline', label: 'Mindmap: Outline View', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.cycleView', label: 'Mindmap: Cycle View', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.togglePanel', label: 'Mindmap: Toggle Side Panel', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.focusNode', label: 'Mindmap: Focus Node', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.cancelFocus', label: 'Mindmap: Cancel Focus', category: 'mindmap', scope: 'mindmap', defaults: [] },
```

In `app/src/i18n/en.ts`, inside the `mindmap: {` block (the one containing `parseError`), add:

```ts
    viewMap: 'Map',
    viewSource: 'Source',
    viewOutline: 'Outline',
    sourceInvalid: 'Fix the JSON before leaving Source view',
    openedExistingMmap: 'Opened existing {name} (imported earlier)',
    toolbarUndo: 'Undo',
    toolbarRedo: 'Redo',
    toolbarPanel: 'Side panel',
    toolbarMore: 'More actions',
    menuExport: 'Export',
    panelNode: 'Node',
    panelMap: 'Map',
    panelSelectOne: 'Select one node',
    panelReadOnly: 'Editing is off in read-only and graph view',
    fieldTextColor: 'Text color',
    fieldBackground: 'Background',
    fieldFontSize: 'Font size',
    fieldBold: 'Bold',
    fieldBranchColor: 'Branch color',
    fieldTags: 'Tags',
    fieldTagsHint: 'Separate tags with commas',
    fieldIcons: 'Icons',
    fieldUrl: 'URL',
    fieldUrlInvalid: 'Only http, https and mailto links are allowed',
    fieldNote: 'Note',
    fieldClear: 'Clear',
    fieldCompact: 'Compact',
    fieldBranchStyle: 'Branch style',
    branchCurve: 'Curve',
    branchStraight: 'Straight',
    fieldFont: 'Font',
    fontSystem: 'System',
    fontSerif: 'Serif',
    fontMono: 'Monospace',
    useGlobalDefault: 'Use global default',
    settingsDefaults: 'Mindmap defaults',
```

- [ ] **Step 6: Build**

Run: `cd app && pnpm build`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/mindmap-view-mode.ts app/src/lib/mindmap-view-mode.test.ts app/src/types.ts app/src/lib/keybindings.ts app/src/i18n/en.ts
git commit -m "feat(mindmap): view-mode model, view/panel/focus actions and strings"
```

---

### Task 2: XMind open never duplicates an existing `.mmap`

**Files:**
- Create: `app/src/lib/mindmap-xmind-open.ts`
- Test: `app/src/lib/mindmap-xmind-open.test.ts`
- Modify: `app/src-tauri/src/commands.rs:375` (after `fs_dir_exists`), `app/src-tauri/src/lib.rs:203`, `app/src-tauri/src/runner.rs:809`, `app/src/composables/useFiles.ts:429-446` (`openXmind`)

**Interfaces:**
- Consumes: `mmapPathFor(path: string): string` from `mindmap-format.ts`.
- Produces:
  ```ts
  export interface XmindTabRef { id: string; filePath?: string; importedFrom?: string }
  export type XmindOpenPlan =
    | { kind: 'activate'; tabId: string }
    | { kind: 'open-mmap'; path: string }
    | { kind: 'import' };
  export function planXmindOpen(xmindPath: string, tabs: readonly XmindTabRef[], mmapExists: boolean): XmindOpenPlan;
  ```
- Tauri: `fs_file_exists(path: String) -> bool`.

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/mindmap-xmind-open.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planXmindOpen } from './mindmap-xmind-open.ts';

const XMIND = '/notes/plan.xmind';
const MMAP = '/notes/plan.mmap';

test('activates the tab that imported this xmind', () => {
  const plan = planXmindOpen(XMIND, [{ id: 'a', importedFrom: XMIND }], true);
  assert.deepEqual(plan, { kind: 'activate', tabId: 'a' });
});

test('activates an open tab of the sibling mmap', () => {
  const plan = planXmindOpen(XMIND, [{ id: 'b', filePath: MMAP }], true);
  assert.deepEqual(plan, { kind: 'activate', tabId: 'b' });
});

test('opens the sibling mmap from disk when no tab has it', () => {
  assert.deepEqual(planXmindOpen(XMIND, [], true), { kind: 'open-mmap', path: MMAP });
});

test('imports when nothing exists', () => {
  assert.deepEqual(planXmindOpen(XMIND, [{ id: 'c', filePath: '/notes/other.mmap' }], false), { kind: 'import' });
});

test('importedFrom wins over a filePath match', () => {
  const tabs = [{ id: 'b', filePath: MMAP }, { id: 'a', importedFrom: XMIND }];
  assert.deepEqual(planXmindOpen(XMIND, tabs, true), { kind: 'activate', tabId: 'a' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-xmind-open.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/lib/mindmap-xmind-open.ts
import { mmapPathFor } from './mindmap-format.ts';

export interface XmindTabRef { id: string; filePath?: string; importedFrom?: string }

export type XmindOpenPlan =
  | { kind: 'activate'; tabId: string }
  | { kind: 'open-mmap'; path: string }
  | { kind: 'import' };

export function planXmindOpen(xmindPath: string, tabs: readonly XmindTabRef[], mmapExists: boolean): XmindOpenPlan {
  const imported = tabs.find((t) => t.importedFrom === xmindPath);
  if (imported) return { kind: 'activate', tabId: imported.id };
  const mmapPath = mmapPathFor(xmindPath);
  const opened = tabs.find((t) => t.filePath === mmapPath);
  if (opened) return { kind: 'activate', tabId: opened.id };
  return mmapExists ? { kind: 'open-mmap', path: mmapPath } : { kind: 'import' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-xmind-open.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Add the Rust command with a test**

In `app/src-tauri/src/commands.rs`, after `fs_dir_exists`:

```rust
/// True only for an existing regular file. Lets the XMind importer open a
/// previously saved `.mmap` instead of creating a colliding unsaved import.
#[tauri::command]
pub fn fs_file_exists(path: String) -> bool {
    Path::new(&path).is_file()
}
```

In the `mod tests` block of `commands.rs`, add:

```rust
    #[test]
    fn fs_file_exists_distinguishes_files_and_dirs() {
        let dir = std::env::temp_dir().join("solomd_fs_file_exists_test");
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("a.mmap");
        std::fs::write(&file, "{}").unwrap();
        assert!(fs_file_exists(file.to_string_lossy().into_owned()));
        assert!(!fs_file_exists(dir.to_string_lossy().into_owned()));
        assert!(!fs_file_exists(dir.join("missing.mmap").to_string_lossy().into_owned()));
        std::fs::remove_dir_all(&dir).unwrap();
    }
```

Register `commands::fs_file_exists,` right after `commands::fs_dir_exists,` in both `app/src-tauri/src/lib.rs` and `app/src-tauri/src/runner.rs`.

Run: `cd app/src-tauri && cargo test fs_file_exists`
Expected: PASS, 1 test.

- [ ] **Step 6: Wire `openXmind`**

In `app/src/composables/useFiles.ts`, add the import:

```ts
import { planXmindOpen } from '../lib/mindmap-xmind-open';
```

Replace the body of `openXmind` up to the in-flight check with:

```ts
  async function sidecarMmapExists(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>('fs_file_exists', { path: mmapPathFor(path) });
    } catch {
      return false;
    }
  }

  async function openXmind(path: string): Promise<void> {
    const plan = planXmindOpen(path, tabs.tabs, await sidecarMmapExists(path));
    if (plan.kind === 'activate') {
      tabs.activate(plan.tabId);
      return;
    }
    if (plan.kind === 'open-mmap') {
      await openPath(plan.path, { bypassNewWindow: true });
      toasts.info(t('mindmap.openedExistingMmap', { name: fileNameOf(plan.path) }));
      return;
    }
    if (xmindImportsInFlight.has(path)) return;
    // ...existing in-flight + importXmindTab body unchanged
  }
```

If `useFiles.ts` has no `t` in scope, add `const { t } = useI18n();` next to the other store setup and `import { useI18n } from '../i18n';`. Keep the rest of the function (in-flight set, try/catch/finally) unchanged.

- [ ] **Step 7: Build and verify in the browser**

Run: `cd app && pnpm build` → success.
Browser (web dev server with a workspace containing `plan.xmind` and `plan.mmap`): open `plan.xmind` → the existing `plan.mmap` tab opens with the toast; open it again → same tab activates, tab count unchanged. Delete `plan.mmap`, reopen `plan.xmind` → import tab as before.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/mindmap-xmind-open.ts app/src/lib/mindmap-xmind-open.test.ts app/src/composables/useFiles.ts app/src-tauri/src/commands.rs app/src-tauri/src/lib.rs app/src-tauri/src/runner.rs
git commit -m "fix(mindmap): opening an .xmind reuses an existing .mmap tab or file"
```

---

### Task 3: Map display model, envelope `display`, global defaults

**Files:**
- Create: `app/src/lib/mindmap-display.ts`
- Test: `app/src/lib/mindmap-display.test.ts`
- Modify: `app/src/lib/mindmap-format.ts` (envelope, `parseMindmap`, `serializeMindmap`, `MindmapCodec`), `app/src/lib/mindmap-format.test.ts`, `app/src/stores/settings.ts` (interface, `defaults()`, `load()`, actions)

**Interfaces:**
- Produces:
  ```ts
  export type BranchStyle = 'curve' | 'straight';
  export type MapFont = 'system' | 'serif' | 'mono';
  export interface MapDisplay { compact?: boolean; branchStyle?: BranchStyle; textColor?: string; font?: MapFont }
  export type ResolvedMapDisplay = { compact: boolean; branchStyle: BranchStyle; textColor: string | null; font: MapFont };
  export const DEFAULT_MAP_DISPLAY: ResolvedMapDisplay;
  export const FONT_STACKS: Readonly<Record<MapFont, string>>;
  export function parseMapDisplay(value: unknown): MapDisplay;
  export function resolveMapDisplay(override: MapDisplay, defaults: MapDisplay): ResolvedMapDisplay;
  export function isSafeColor(value: unknown): value is string;
  export function straightMainBranch(p: BranchBox): string;
  export function straightSubBranch(p: BranchBox): string;
  export interface BranchBox { pT: number; pL: number; pW: number; pH: number; cT: number; cL: number; cW: number; cH: number; direction: string }
  ```
- `mindmap-format.ts`:
  ```ts
  export type MindmapParseResult =
    | { ok: true; data: MindElixirData; isEmpty: boolean; display: MapDisplay }
    | { ok: false; error: string };
  export function serializeMindmap(data: MindElixirData, display?: MapDisplay): string;
  export interface MindmapCodec { parse(text: string): MindmapParseResult; serialize(data: MindElixirData, display?: MapDisplay): string }
  ```
- Settings: `mindmapDefaults: MapDisplay`, `mindmapPanelOpen: boolean`, actions `setMindmapDefaults(patch: MapDisplay): void`, `clearMindmapDefault(key: keyof MapDisplay): void`, `toggleMindmapPanel(): void`.

- [ ] **Step 1: Write the failing display test**

```ts
// app/src/lib/mindmap-display.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MAP_DISPLAY, parseMapDisplay, resolveMapDisplay, straightMainBranch, straightSubBranch } from './mindmap-display.ts';

test('parseMapDisplay keeps valid keys and drops the rest', () => {
  const parsed = parseMapDisplay({ compact: true, branchStyle: 'zigzag', textColor: '#ff0000', font: 'mono', extra: 1 });
  assert.deepEqual(parsed, { compact: true, textColor: '#ff0000', font: 'mono' });
});

test('parseMapDisplay rejects unsafe colors and non-objects', () => {
  assert.deepEqual(parseMapDisplay({ textColor: 'url(javascript:x)' }), {});
  assert.deepEqual(parseMapDisplay('compact'), {});
  assert.deepEqual(parseMapDisplay(null), {});
});

test('resolveMapDisplay prefers override, then defaults, then built-ins', () => {
  const resolved = resolveMapDisplay({ compact: true }, { compact: false, font: 'serif' });
  assert.deepEqual(resolved, { ...DEFAULT_MAP_DISPLAY, compact: true, font: 'serif' });
});

test('straight branches are single line segments', () => {
  const box = { pT: 0, pL: 0, pW: 100, pH: 40, cT: 100, cL: 200, cW: 80, cH: 30, direction: 'rhs' };
  assert.match(straightMainBranch(box), /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  assert.match(straightSubBranch(box), /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
});

test('left-side branches end on the child right edge', () => {
  const box = { pT: 0, pL: 300, pW: 100, pH: 40, cT: 100, cL: 100, cW: 80, cH: 30, direction: 'lhs' };
  assert.equal(straightSubBranch(box), 'M 300 20 L 180 115');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-display.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/lib/mindmap-display.ts
export type BranchStyle = 'curve' | 'straight';
export type MapFont = 'system' | 'serif' | 'mono';

export interface MapDisplay { compact?: boolean; branchStyle?: BranchStyle; textColor?: string; font?: MapFont }
export type ResolvedMapDisplay = { compact: boolean; branchStyle: BranchStyle; textColor: string | null; font: MapFont };
export interface BranchBox { pT: number; pL: number; pW: number; pH: number; cT: number; cL: number; cW: number; cH: number; direction: string }

const BRANCH_STYLES: readonly BranchStyle[] = ['curve', 'straight'];
const MAP_FONTS: readonly MapFont[] = ['system', 'serif', 'mono'];
const SAFE_COLOR_PATTERN = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]{3,20})$/i;
const LEFT_DIRECTION = 'lhs';
const HALF = 2;

export const DEFAULT_MAP_DISPLAY: ResolvedMapDisplay = { compact: false, branchStyle: 'curve', textColor: null, font: 'system' };

export const FONT_STACKS: Readonly<Record<MapFont, string>> = {
  system: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: '"JetBrains Mono", Menlo, Consolas, monospace',
};

export function isSafeColor(value: unknown): value is string {
  return typeof value === 'string' && SAFE_COLOR_PATTERN.test(value.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseMapDisplay(value: unknown): MapDisplay {
  if (!isRecord(value)) return {};
  const out: MapDisplay = {};
  if (typeof value.compact === 'boolean') out.compact = value.compact;
  if (BRANCH_STYLES.includes(value.branchStyle as BranchStyle)) out.branchStyle = value.branchStyle as BranchStyle;
  if (isSafeColor(value.textColor)) out.textColor = value.textColor.trim();
  if (MAP_FONTS.includes(value.font as MapFont)) out.font = value.font as MapFont;
  return out;
}

export function resolveMapDisplay(override: MapDisplay, defaults: MapDisplay): ResolvedMapDisplay {
  return {
    compact: override.compact ?? defaults.compact ?? DEFAULT_MAP_DISPLAY.compact,
    branchStyle: override.branchStyle ?? defaults.branchStyle ?? DEFAULT_MAP_DISPLAY.branchStyle,
    textColor: override.textColor ?? defaults.textColor ?? DEFAULT_MAP_DISPLAY.textColor,
    font: override.font ?? defaults.font ?? DEFAULT_MAP_DISPLAY.font,
  };
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

function childAnchorX(p: BranchBox): number {
  return p.direction === LEFT_DIRECTION ? p.cL + p.cW : p.cL;
}

export function straightMainBranch(p: BranchBox): string {
  return line(p.pL + p.pW / HALF, p.pT + p.pH / HALF, childAnchorX(p), p.cT + p.cH / HALF);
}

export function straightSubBranch(p: BranchBox): string {
  const parentX = p.direction === LEFT_DIRECTION ? p.pL : p.pL + p.pW;
  return line(parentX, p.pT + p.pH / HALF, childAnchorX(p), p.cT + p.cH / HALF);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-display.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Write the failing envelope test**

Append to `app/src/lib/mindmap-format.test.ts`:

```ts
test('display block round-trips through the envelope', () => {
  const data = createEmptyMindmap('Root');
  const text = serializeMindmap(data, { compact: true, font: 'serif' });
  const parsed = parseMindmap(text, 'Root');
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.display, { compact: true, font: 'serif' });
});

test('empty display is omitted from the file', () => {
  const text = serializeMindmap(createEmptyMindmap('Root'), {});
  assert.equal(JSON.parse(text).display, undefined);
});

test('invalid display values are dropped on parse', () => {
  const text = JSON.stringify({ format: 'solomd-mindmap', version: 1, data: createEmptyMindmap('R'), display: { textColor: 'expression(x)', compact: 'yes' } });
  const parsed = parseMindmap(text, 'R');
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.display, {});
});
```

If `createEmptyMindmap`, `serializeMindmap` or `parseMindmap` are not yet imported in that test file, add them to its existing import from `./mindmap-format.ts`.

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-format.test.ts`
Expected: FAIL (`display` undefined / serialize ignores second argument).

- [ ] **Step 6: Implement envelope `display`**

In `app/src/lib/mindmap-format.ts`:

```ts
import { parseMapDisplay, type MapDisplay } from './mindmap-display.ts';

interface MindmapEnvelope {
  format: typeof FORMAT_ID;
  version: typeof FORMAT_VERSION;
  data: MindElixirData;
  display?: MapDisplay;
}

export type MindmapParseResult =
  | { ok: true; data: MindElixirData; isEmpty: boolean; display: MapDisplay }
  | { ok: false; error: string };

export function serializeMindmap(data: MindElixirData, display: MapDisplay = {}): string {
  const envelope: MindmapEnvelope = { format: FORMAT_ID, version: FORMAT_VERSION, data: documentFields(data) };
  if (Object.keys(display).length > 0) envelope.display = display;
  return `${JSON.stringify(envelope, null, JSON_INDENT)}\n`;
}
```

In `parseMindmap`, return `display: {}` on the empty branch and `display: parseMapDisplay((json as MindmapEnvelope).display)` on the success branch. Update `MindmapCodec.serialize` to `serialize(data: MindElixirData, display?: MapDisplay): string` and `mmapCodec` to pass it through: `serialize: (data, display) => serializeMindmap(data, display)`.

Any other `MindmapCodec` implementation (fence codec in `mindmap-fence.ts`) keeps its one-argument `serialize`; TypeScript accepts it. Any other code that builds an `ok: true` `MindmapParseResult` literal (grep `isEmpty:`) must add `display: {}`.

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-format.test.ts src/lib/mindmap-display.test.ts`
Expected: PASS.

- [ ] **Step 7: Settings fields**

In `app/src/stores/settings.ts`:

```ts
import { parseMapDisplay, type MapDisplay } from '../lib/mindmap-display';
```

Add to `interface Settings`:

```ts
  /** Phase 7 — global map display defaults; a `.mmap` `display` block overrides per key. */
  mindmapDefaults: MapDisplay;
  mindmapPanelOpen: boolean;
```

Add to `defaults()`: `mindmapDefaults: {},` and `mindmapPanelOpen: false,`.
In `load()`, after `merged.pdfDefaults = ...`: `merged.mindmapDefaults = parseMapDisplay(parsed.mindmapDefaults);`
Add actions:

```ts
    setMindmapDefaults(patch: MapDisplay) {
      this.mindmapDefaults = parseMapDisplay({ ...this.mindmapDefaults, ...patch });
      this.persist();
    },
    clearMindmapDefault(key: keyof MapDisplay) {
      const next = { ...this.mindmapDefaults };
      delete next[key];
      this.mindmapDefaults = next;
      this.persist();
    },
    toggleMindmapPanel() {
      this.mindmapPanelOpen = !this.mindmapPanelOpen;
      this.persist();
    },
```

- [ ] **Step 8: Build**

Run: `cd app && pnpm build`
Expected: success.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/mindmap-display.ts app/src/lib/mindmap-display.test.ts app/src/lib/mindmap-format.ts app/src/lib/mindmap-format.test.ts app/src/stores/settings.ts
git commit -m "feat(mindmap): map display model with per-file override and global defaults"
```

---

### Task 4: Node field validators

**Files:**
- Create: `app/src/lib/mindmap-node-style.ts`
- Test: `app/src/lib/mindmap-node-style.test.ts`

**Interfaces:**
- Consumes: `isSafeColor` from `mindmap-display.ts`.
- Produces:
  ```ts
  export const FONT_SIZE_MIN: 12; export const FONT_SIZE_MAX: 40;
  export const NODE_ICONS: readonly string[];
  export type NodeField = 'color' | 'background' | 'fontSize' | 'bold' | 'branchColor' | 'tags' | 'icons' | 'hyperLink' | 'note';
  export type NodePatchResult = { ok: true; patch: Partial<NodeObj> } | { ok: false; reason: 'invalid' };
  export function buildNodePatch(node: NodeObj, field: NodeField, value: string | number | boolean | null): NodePatchResult;
  export function isSafeLink(value: string): boolean;
  export function toggleIcon(icons: readonly string[] | undefined, icon: string): string[];
  ```
- `null` means "clear this field".

- [ ] **Step 1: Write the failing test**

```ts
// app/src/lib/mindmap-node-style.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { buildNodePatch, isSafeLink, toggleIcon } from './mindmap-node-style.ts';

const node: NodeObj = { id: 'n1', topic: 'A', style: { fontWeight: 'bold', color: '#111' } };

test('color merges into existing style', () => {
  assert.deepEqual(buildNodePatch(node, 'background', '#ffeeaa'), { ok: true, patch: { style: { fontWeight: 'bold', color: '#111', background: '#ffeeaa' } } });
});

test('null clears a style key', () => {
  assert.deepEqual(buildNodePatch(node, 'color', null), { ok: true, patch: { style: { fontWeight: 'bold' } } });
});

test('unsafe color is rejected', () => {
  assert.deepEqual(buildNodePatch(node, 'color', 'url(x)'), { ok: false, reason: 'invalid' });
});

test('font size is clamped and written as px', () => {
  const result = buildNodePatch(node, 'fontSize', 99);
  assert.equal(result.ok && result.patch.style?.fontSize, '40px');
});

test('bold toggles fontWeight', () => {
  const result = buildNodePatch(node, 'bold', false);
  assert.deepEqual(result, { ok: true, patch: { style: { color: '#111' } } });
});

test('tags split on commas, trim, drop empties and angle brackets', () => {
  assert.deepEqual(buildNodePatch(node, 'tags', ' a, <b> ,, c '), { ok: true, patch: { tags: ['a', 'b', 'c'] } });
});

test('links must be http, https or mailto', () => {
  assert.equal(isSafeLink('https://x.dev'), true);
  assert.equal(isSafeLink('javascript:alert(1)'), false);
  assert.deepEqual(buildNodePatch(node, 'hyperLink', 'javascript:alert(1)'), { ok: false, reason: 'invalid' });
  assert.deepEqual(buildNodePatch(node, 'hyperLink', ''), { ok: true, patch: { hyperLink: undefined } });
});

test('note is stored as plain text', () => {
  assert.deepEqual(buildNodePatch(node, 'note', 'line 1\nline 2'), { ok: true, patch: { note: 'line 1\nline 2' } });
});

test('toggleIcon adds then removes', () => {
  assert.deepEqual(toggleIcon(undefined, '⭐'), ['⭐']);
  assert.deepEqual(toggleIcon(['⭐', '✅'], '⭐'), ['✅']);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-node-style.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// app/src/lib/mindmap-node-style.ts
import type { NodeObj } from 'mind-elixir';
import { isSafeColor } from './mindmap-display.ts';

export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 40;
export const NODE_ICONS: readonly string[] = ['⭐', '✅', '❌', '⚠️', '📝', '💡', '📌', '🔍', '🔥', '📅', '⏳', '🔒', '🚀', '🎯', '💬', '🌍', '❤️', '🔄'];

export type NodeField = 'color' | 'background' | 'fontSize' | 'bold' | 'branchColor' | 'tags' | 'icons' | 'hyperLink' | 'note';
export type NodePatchResult = { ok: true; patch: Partial<NodeObj> } | { ok: false; reason: 'invalid' };
type FieldValue = string | number | boolean | null;
type NodeStyle = NonNullable<NodeObj['style']>;

const SAFE_LINK_PATTERN = /^(https?:|mailto:)/i;
const ANGLE_BRACKET_PATTERN = /[<>]/g;
const TAG_SEPARATOR = ',';
const BOLD_WEIGHT = 'bold';
const PX = 'px';
const INVALID: NodePatchResult = { ok: false, reason: 'invalid' };

export function isSafeLink(value: string): boolean {
  return SAFE_LINK_PATTERN.test(value.trim());
}

export function toggleIcon(icons: readonly string[] | undefined, icon: string): string[] {
  const current = icons ?? [];
  return current.includes(icon) ? current.filter((i) => i !== icon) : [...current, icon];
}

function withStyle(node: NodeObj, key: keyof NodeStyle, value: string | null): NodePatchResult {
  const style: NodeStyle = { ...(node.style ?? {}) };
  if (value === null) delete style[key];
  else style[key] = value;
  return { ok: true, patch: { style } };
}

function colorPatch(node: NodeObj, key: 'color' | 'background', value: FieldValue): NodePatchResult {
  if (value === null) return withStyle(node, key, null);
  return isSafeColor(value) ? withStyle(node, key, value.trim()) : INVALID;
}

function fontSizePatch(node: NodeObj, value: FieldValue): NodePatchResult {
  if (value === null) return withStyle(node, 'fontSize', null);
  if (typeof value !== 'number' || !Number.isFinite(value)) return INVALID;
  const size = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(value)));
  return withStyle(node, 'fontSize', `${size}${PX}`);
}

function tagsPatch(value: FieldValue): NodePatchResult {
  if (typeof value !== 'string') return { ok: true, patch: { tags: undefined } };
  const tags = value.split(TAG_SEPARATOR).map((t) => t.replace(ANGLE_BRACKET_PATTERN, '').trim()).filter(Boolean);
  return { ok: true, patch: { tags: tags.length > 0 ? tags : undefined } };
}

function linkPatch(value: FieldValue): NodePatchResult {
  if (value === null || value === '') return { ok: true, patch: { hyperLink: undefined } };
  return typeof value === 'string' && isSafeLink(value) ? { ok: true, patch: { hyperLink: value.trim() } } : INVALID;
}

function branchColorPatch(value: FieldValue): NodePatchResult {
  if (value === null) return { ok: true, patch: { branchColor: undefined } };
  return isSafeColor(value) ? { ok: true, patch: { branchColor: value.trim() } } : INVALID;
}

function iconsPatch(value: FieldValue): NodePatchResult {
  if (typeof value !== 'string') return { ok: true, patch: { icons: undefined } };
  const icons = value.split(TAG_SEPARATOR).filter((icon) => NODE_ICONS.includes(icon));
  return { ok: true, patch: { icons: icons.length > 0 ? icons : undefined } };
}

export function buildNodePatch(node: NodeObj, field: NodeField, value: FieldValue): NodePatchResult {
  switch (field) {
    case 'color':
    case 'background':
      return colorPatch(node, field, value);
    case 'fontSize': return fontSizePatch(node, value);
    case 'bold': return withStyle(node, 'fontWeight', value === true ? BOLD_WEIGHT : null);
    case 'branchColor': return branchColorPatch(value);
    case 'tags': return tagsPatch(value);
    case 'icons': return iconsPatch(value);
    case 'hyperLink': return linkPatch(value);
    case 'note': return { ok: true, patch: { note: typeof value === 'string' && value !== '' ? value : undefined } };
  }
}
```

Icons travel as a comma-joined string so the panel can call `buildNodePatch(node, 'icons', toggleIcon(node.icons, icon).join(','))`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-node-style.test.ts`
Expected: PASS, 9/9.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-node-style.ts app/src/lib/mindmap-node-style.test.ts
git commit -m "feat(mindmap): validated node field patches for the side panel"
```

---

### Task 5: View shell — Map / Source / Outline

**Files:**
- Modify: `app/src/components/MindmapCanvas.vue` (props, emits, `defineExpose`, display override capture, `registerActive`)
- Modify: `app/src/components/MindmapView.vue` (rewrite as shell)

**Interfaces:**
- Consumes: Task 1 (`normalizeMindmapMode`, `targetModeFor`, `checkSourceExit`, `VIEW_ACTIONS`), Task 3 (`MapDisplay`, codec `display`).
- Produces (canvas `defineExpose`):
  ```ts
  export interface MindmapCanvasApi {
    flush(): void;
    run(actionId: string): boolean;
    getMind(): MindElixirInstance | null;
    getDisplayOverride(): MapDisplay;
    setDisplayOverride(next: MapDisplay): void;
    isReadOnly: Ref<boolean>;
    isGraphView: Ref<boolean>;
  }
  ```
  Canvas new prop `registerActive?: boolean` (default `true`); new emit `selection: [nodes: NodeObj[]]`.
- `MindmapView` registers one composite `MindmapHandle` that runs view actions itself and delegates the rest to the canvas.

- [ ] **Step 1: Canvas — display override and API**

In `MindmapCanvas.vue`:

```ts
import type { Ref } from 'vue';
import type { MapDisplay } from '../lib/mindmap-display';

const props = withDefaults(
  defineProps<{ content: string; codec: MindmapCodec; exportName?: string; fenceLine?: number; registerActive?: boolean }>(),
  { exportName: 'mindmap', registerActive: true },
);
const emit = defineEmits<{
  'update:content': [text: string];
  'open-as-text': [];
  'jump-to-source': [source: MindmapSource];
  selection: [nodes: NodeObj[]];
}>();

let displayOverride: MapDisplay = {};
```

In `loadData()`, after a successful parse: `displayOverride = parsed.display;`.
In `syncNow()` and the `pristineSerialized` assignment, call `props.codec.serialize(mind.getData(), displayOverride)`.
In `activate()`: `if (props.registerActive) setActiveMindmap(handle);`.
After `mind.init(data)` in `mount()`, forward selection:

```ts
  mind.bus.addListener('selectNodes', emitSelection);
  mind.bus.addListener('unselectNodes', emitSelection);
```

```ts
function emitSelection(): void {
  emit('selection', mind?.currentNodes?.map((tpc) => tpc.nodeObj) ?? []);
}
```

(If `currentNodes` is not on the 5.15.1 instance type, use `mind?.currentNode ? [mind.currentNode.nodeObj] : []` and note it in the task report.)

Replace `defineExpose({ flush: flushPendingSync });` with:

```ts
function setDisplayOverride(next: MapDisplay): void {
  displayOverride = next;
  scheduleSync();
}

defineExpose({
  flush: flushPendingSync,
  run: (actionId: string) => handle.run(actionId),
  getMind: () => mind,
  getDisplayOverride: () => displayOverride,
  setDisplayOverride,
  isReadOnly,
  isGraphView,
});
```

Declare the API type in `app/src/lib/mindmap-active.ts` (a `<script setup>` file cannot export types):

```ts
import type { Ref } from 'vue';
import type { MindElixirInstance } from 'mind-elixir';
import type { MapDisplay } from './mindmap-display.ts';

export interface MindmapCanvasApi {
  flush(): void;
  run(actionId: string): boolean;
  getMind(): MindElixirInstance | null;
  getDisplayOverride(): MapDisplay;
  setDisplayOverride(next: MapDisplay): void;
  isReadOnly: Ref<boolean>;
  isGraphView: Ref<boolean>;
}
```

- [ ] **Step 2: Rewrite `MindmapView.vue` as the shell**

```vue
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import type { Tab } from '../types';
import { useI18n } from '../i18n';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useSettingsStore } from '../stores/settings';
import { mmapCodec } from '../lib/mindmap-format';
import { mapToHeadingsMarkdown } from '../lib/mindmap-headings';
import { withoutGateArrows } from '../lib/mindmap-graph';
import { checkSourceExit, normalizeMindmapMode, targetModeFor, VIEW_ACTIONS, type MindmapMode } from '../lib/mindmap-view-mode';
import { clearActiveMindmap, setActiveMindmap, type MindmapCanvasApi, type MindmapHandle } from '../lib/mindmap-active';
import { eventToCombo, resolveBindings } from '../lib/keybindings';
import { useMindmapJump } from '../composables/useMindmapJump';
import type { MindmapSource } from '../lib/mindmap-source';
import MindmapCanvas from './MindmapCanvas.vue';
import Editor from './Editor.vue';
import Preview from './Preview.vue';

const SOURCE_LANGUAGE = 'json';
const props = defineProps<{ tab: Tab }>();
const tabs = useTabsStore();
const toasts = useToastsStore();
const settings = useSettingsStore();
const { t } = useI18n();
const { jumpTo } = useMindmapJump();
const codec = computed(() => mmapCodec(props.tab.fileName));
const exportName = computed(() => props.tab.fileName.replace(/\.[^.]+$/u, ''));
const mode = computed<MindmapMode>(() => normalizeMindmapMode(props.tab.mindmapMode));
const canvas = ref<MindmapCanvasApi | null>(null);
const sourceError = ref<string | null>(null);

const sourceTab = computed<Tab>(() => new Proxy(props.tab, {
  get: (target, key) => (key === 'language' ? SOURCE_LANGUAGE : Reflect.get(target, key)),
}));

const outlineMarkdown = computed(() => {
  if (mode.value !== 'outline') return '';
  const parsed = codec.value.parse(props.tab.content);
  return parsed.ok ? mapToHeadingsMarkdown(withoutGateArrows(parsed.data)) : '';
});

function setMode(next: MindmapMode): void {
  if (next === mode.value) return;
  if (mode.value === 'map') canvas.value?.flush();
  if (mode.value === 'source' && !leaveSourceAllowed()) return;
  sourceError.value = null;
  props.tab.mindmapMode = next;
  tabs.persist();
}

function leaveSourceAllowed(): boolean {
  const exit = checkSourceExit(props.tab.content, (text) => codec.value.parse(text));
  if (exit.ok) return true;
  sourceError.value = exit.error;
  toasts.error(t('mindmap.sourceInvalid'));
  return false;
}

function runViewAction(actionId: string): boolean {
  const target = targetModeFor(actionId, mode.value);
  if (target === null) return false;
  setMode(target);
  return true;
}

const handle: MindmapHandle = {
  run: (actionId) => runViewAction(actionId) || (canvas.value?.run(actionId) ?? false),
};

function activate(): void {
  setActiveMindmap(handle);
}

function onViewKey(e: KeyboardEvent): void {
  const combo = eventToCombo(e);
  const actionId = combo ? resolveBindings(settings.keybindings, 'mindmap').get(combo) : undefined;
  if (!actionId || !(actionId in VIEW_ACTIONS)) return;
  e.preventDefault();
  e.stopPropagation();
  runViewAction(actionId);
}

function onUpdate(text: string): void {
  tabs.setContent(props.tab.id, text);
}

function onJump(source: MindmapSource): void {
  if (!source.path) {
    toasts.info(t('mindmap.sourceUnavailable'));
    return;
  }
  void jumpTo(source, props.tab.id);
}

onMounted(activate);
onBeforeUnmount(() => clearActiveMindmap(handle));
defineExpose({ setMode, canvas, mode });
</script>

<template>
  <div class="mindmap-shell" @keydown.capture="onViewKey" @focusin="activate" @pointerdown="activate">
    <div class="mindmap-shell__body">
      <MindmapCanvas
        v-if="mode === 'map'"
        ref="canvas"
        :content="tab.content"
        :codec="codec"
        :export-name="exportName"
        :register-active="false"
        @update:content="onUpdate"
        @open-as-text="setMode('source')"
        @jump-to-source="onJump"
      />
      <div v-else-if="mode === 'source'" class="mindmap-shell__source">
        <div v-if="sourceError" class="mindmap-shell__error" role="alert">{{ sourceError }}</div>
        <Editor :key="`${tab.id}-source`" :tab="sourceTab" />
      </div>
      <Preview v-else :source="outlineMarkdown" class="mindmap-shell__outline" />
    </div>
  </div>
</template>

<style scoped>
.mindmap-shell { display: flex; flex-direction: column; width: 100%; height: 100%; }
.mindmap-shell__body { position: relative; flex: 1; min-height: 0; display: flex; }
.mindmap-shell__body > * { flex: 1; min-width: 0; }
.mindmap-shell__source { display: flex; flex-direction: column; }
.mindmap-shell__error { padding: 6px 12px; font-size: 12px; background: var(--bg-secondary, #fee); border-block-end: 1px solid var(--border, #ccc); }
.mindmap-shell__outline { overflow: auto; }
</style>
```

Check the exact export names `eventToCombo` and `resolveBindings` in `app/src/lib/keybindings.ts` (both are imported by existing mindmap code) and the `Preview` required props (`source` is required; omit `tabId` so Preview stays read-only).

- [ ] **Step 3: Build**

Run: `cd app && pnpm build`
Expected: success.

- [ ] **Step 4: Browser verification**

Dev server with a sample `.mmap` (include a Hebrew topic):
1. Palette → "Mindmap: Source View" → JSON shows in the code editor, highlighted.
2. Break the JSON (delete a brace) → "Mindmap: Map View" → stays in Source, inline error + toast.
3. Fix it → Map View works; edit a node in Map → Source shows the change.
4. "Mindmap: Outline View" → headings render; Hebrew lines are RTL.
5. Reload the app → each tab restores its last mode.
6. Corrupt the file, open it → Map shows the parse-error screen → "Open as text" switches to Source (tab language stays `mindmap`).
7. A mindmap fence in a Markdown preview still opens and edits (the canvas still registers itself there).

- [ ] **Step 5: Commit**

```bash
git add app/src/components/MindmapView.vue app/src/components/MindmapCanvas.vue app/src/lib/mindmap-active.ts
git commit -m "feat(mindmap): Map / Source / Outline view modes per tab"
```

---

### Task 6: Toolbar, overflow menu, context menu, focus commands

**Files:**
- Create: `app/src/components/MindmapToolbar.vue`
- Modify: `app/src/components/MindmapView.vue` (mount toolbar), `app/src/components/MindmapCanvas.vue` (actions `mindmap.focusNode`, `mindmap.cancelFocus`, `mindmap.undo`, `mindmap.redo`; context-menu "Jump to source"), `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: `MindmapMode`, `MindmapCanvasApi`, existing action ids from `useMindmapCanvasActions` and `keybindings.ts`.
- Produces: `<MindmapToolbar :mode :is-panel-open :is-read-only :is-graph-view @set-mode @run @toggle-panel />` where `run` emits an action id string.

- [ ] **Step 1: Canvas actions**

In `MindmapCanvas.vue`, add to the `actions` record:

```ts
  'mindmap.focusNode': () => { if (mind?.currentNode) mind.focusNode(mind.currentNode); },
  'mindmap.cancelFocus': () => mind?.cancelFocus(),
  'mindmap.undo': () => mind?.undo(),
  'mindmap.redo': () => mind?.redo(),
```

Add a "Jump to source" item to the context menu: change `contextMenu: { extend: gates.menu }` to

```ts
    contextMenu: { extend: [...gates.menu, { name: t('mindmap.jumpToSourceMenu'), onclick: jumpToSource }] },
```

and add `jumpToSourceMenu: 'Jump to source',` to the `mindmap` block in `en.ts`.

- [ ] **Step 2: Toolbar component**

```vue
<!-- app/src/components/MindmapToolbar.vue -->
<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../i18n';
import { MINDMAP_MODES, type MindmapMode } from '../lib/mindmap-view-mode';

const props = defineProps<{ mode: MindmapMode; isPanelOpen: boolean; isReadOnly: boolean; isGraphView: boolean }>();
const emit = defineEmits<{ 'set-mode': [mode: MindmapMode]; run: [actionId: string]; 'toggle-panel': [] }>();
const { t } = useI18n();
const isMenuOpen = ref(false);

const MODE_LABEL_KEYS: Record<MindmapMode, string> = { map: 'mindmap.viewMap', source: 'mindmap.viewSource', outline: 'mindmap.viewOutline' };
const EXPORT_ITEMS: readonly { id: string; label: string }[] = [
  { id: 'mindmap.exportPng', label: 'PNG' },
  { id: 'mindmap.exportSvg', label: 'SVG' },
  { id: 'mindmap.exportHtml', label: 'HTML' },
  { id: 'mindmap.exportJson', label: 'JSON' },
  { id: 'mindmap.exportMarkdown', label: 'Markdown' },
  { id: 'mindmap.exportMermaid', label: 'Mermaid' },
  { id: 'mindmap.exportAdjacency', label: 'Adjacency JSON' },
];
const MAP_ONLY_ITEMS: readonly { id: string; labelKey: string }[] = [
  { id: 'mindmap.copyPlaintext', labelKey: 'mindmap.menuCopyPlaintext' },
  { id: 'mindmap.toHeadingsDocument', labelKey: 'mindmap.menuHeadings' },
  { id: 'mindmap.findDuplicates', labelKey: 'mindmap.menuDuplicates' },
  { id: 'mindmap.shortcutHelp', labelKey: 'mindmap.menuShortcuts' },
];

function runAndClose(actionId: string): void {
  isMenuOpen.value = false;
  emit('run', actionId);
}

function isMap(): boolean {
  return props.mode === 'map';
}
</script>

<template>
  <div class="mm-toolbar" role="toolbar">
    <div class="mm-toolbar__modes" role="tablist">
      <button v-for="m in MINDMAP_MODES" :key="m" type="button" role="tab" :aria-selected="mode === m" :class="{ active: mode === m }" @click="emit('set-mode', m)">
        {{ t(MODE_LABEL_KEYS[m]) }}
      </button>
    </div>
    <template v-if="isMap()">
      <button type="button" :title="t('mindmap.toolbarUndo')" :disabled="isReadOnly || isGraphView" @click="emit('run', 'mindmap.undo')">↶</button>
      <button type="button" :title="t('mindmap.toolbarRedo')" :disabled="isReadOnly || isGraphView" @click="emit('run', 'mindmap.redo')">↷</button>
      <button type="button" :title="t('mindmap.toolbarPanel')" :aria-pressed="isPanelOpen" @click="emit('toggle-panel')">▤</button>
    </template>
    <div class="mm-toolbar__more">
      <button type="button" :title="t('mindmap.toolbarMore')" :aria-expanded="isMenuOpen" :disabled="!isMap()" @click="isMenuOpen = !isMenuOpen">⋯</button>
      <div v-if="isMenuOpen" class="mm-toolbar__menu" role="menu" @keydown.escape="isMenuOpen = false">
        <div class="mm-toolbar__group">{{ t('mindmap.menuExport') }}</div>
        <button v-for="item in EXPORT_ITEMS" :key="item.id" type="button" role="menuitem" @click="runAndClose(item.id)">{{ item.label }}</button>
        <hr />
        <button v-for="item in MAP_ONLY_ITEMS" :key="item.id" type="button" role="menuitem" @click="runAndClose(item.id)">{{ t(item.labelKey) }}</button>
        <hr />
        <button type="button" role="menuitemcheckbox" :aria-checked="isGraphView" @click="runAndClose('mindmap.toggleGraphView')">{{ isGraphView ? '✓ ' : '' }}{{ t('mindmap.graphViewBadge') }}</button>
        <button type="button" role="menuitemcheckbox" :aria-checked="isReadOnly" @click="runAndClose('mindmap.toggleReadOnly')">{{ isReadOnly ? '✓ ' : '' }}{{ t('mindmap.readOnlyBadge') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mm-toolbar { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-block-end: 1px solid var(--border, #ddd); background: var(--bg-secondary, #f6f6f6); font-size: 12px; }
.mm-toolbar button { padding: 2px 8px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
.mm-toolbar button:disabled { opacity: 0.4; cursor: default; }
.mm-toolbar button.active, .mm-toolbar button[aria-pressed='true'] { border-color: var(--border, #ccc); background: var(--bg, #fff); }
.mm-toolbar__modes { display: flex; gap: 2px; margin-inline-end: 8px; }
.mm-toolbar__more { position: relative; margin-inline-start: auto; }
.mm-toolbar__menu { position: absolute; inset-inline-end: 0; inset-block-start: 100%; z-index: 20; display: flex; flex-direction: column; min-width: 200px; padding: 4px; background: var(--bg, #fff); border: 1px solid var(--border, #ccc); border-radius: 6px; box-shadow: 0 4px 16px rgb(0 0 0 / 20%); }
.mm-toolbar__menu button { text-align: start; }
.mm-toolbar__group { padding: 4px 8px; opacity: 0.6; }
.mm-toolbar__menu hr { width: 100%; border: 0; border-block-start: 1px solid var(--border, #ddd); }
</style>
```

Add to the `en.ts` `mindmap` block:

```ts
    menuCopyPlaintext: 'Copy as plaintext',
    menuHeadings: 'Open as Markdown headings',
    menuDuplicates: 'Find duplicates',
    menuShortcuts: 'Keyboard shortcuts',
```

- [ ] **Step 3: Mount in the shell**

In `MindmapView.vue` template, before `.mindmap-shell__body`:

```vue
    <MindmapToolbar
      :mode="mode"
      :is-panel-open="settings.mindmapPanelOpen"
      :is-read-only="canvas?.isReadOnly ?? false"
      :is-graph-view="canvas?.isGraphView ?? false"
      @set-mode="setMode"
      @run="(id) => handle.run(id)"
      @toggle-panel="settings.toggleMindmapPanel()"
    />
```

Import `MindmapToolbar` and make the panel toggle a view-level action:

```ts
const TOGGLE_PANEL_ACTION = 'mindmap.togglePanel';

function runViewAction(actionId: string): boolean {
  if (actionId === TOGGLE_PANEL_ACTION) {
    settings.toggleMindmapPanel();
    return true;
  }
  const target = targetModeFor(actionId, mode.value);
  if (target === null) return false;
  setMode(target);
  return true;
}
```

In `onViewKey`, accept the panel action too: `if (!actionId || !(actionId in VIEW_ACTIONS || actionId === TOGGLE_PANEL_ACTION)) return;`.

Note: `defineExpose` unwraps refs, so `canvas.value.isReadOnly` is already a boolean in the template; type the `canvas` ref as `ref<InstanceType<typeof MindmapCanvas> | null>` if `vue-tsc` complains about `MindmapCanvasApi`'s `Ref` fields, and read `canvas?.isReadOnly` directly.

- [ ] **Step 4: Build**

Run: `cd app && pnpm build`
Expected: success.

- [ ] **Step 5: Browser verification**

1. Every overflow item runs: each export writes a file (Tauri) or shows the save dialog path; copy plaintext toasts; headings opens a tab; duplicates dialog opens; shortcuts dialog opens.
2. Graph view and read-only show a checkmark when on and disable undo/redo.
3. Right-click a node → "Jump to source" present; package Focus / Cancel Focus still present once.
4. Palette "Mindmap: Focus Node" / "Cancel Focus" work.
5. Switch app language to Hebrew → toolbar mirrors (overflow menu opens toward the inline end).

- [ ] **Step 6: Commit**

```bash
git add app/src/components/MindmapToolbar.vue app/src/components/MindmapView.vue app/src/components/MindmapCanvas.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): map toolbar, overflow menu, jump-to-source menu item, focus commands"
```

---

### Task 7: Side panel — Node tab

**Files:**
- Create: `app/src/components/MindmapSidePanel.vue`, `app/src/components/MindmapNodeFields.vue`
- Modify: `app/src/components/MindmapView.vue` (selection state, panel mount)

**Interfaces:**
- Consumes: `buildNodePatch`, `toggleIcon`, `NODE_ICONS`, `FONT_SIZE_MIN`, `FONT_SIZE_MAX` (Task 4); canvas `selection` emit and `getMind()` (Task 5).
- Produces: `<MindmapNodeFields :node :disabled @patch />` where `patch` emits `{ field: NodeField; value: string | number | boolean | null }`; `<MindmapSidePanel>` with slots `node` and `map`.

- [ ] **Step 1: Node fields component**

```vue
<!-- app/src/components/MindmapNodeFields.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { NodeObj } from 'mind-elixir';
import { useI18n } from '../i18n';
import { FONT_SIZE_MAX, FONT_SIZE_MIN, NODE_ICONS, isSafeLink, toggleIcon, type NodeField } from '../lib/mindmap-node-style';

const DEFAULT_FONT_SIZE = 16;
const props = defineProps<{ node: NodeObj; disabled: boolean }>();
const emit = defineEmits<{ patch: [field: NodeField, value: string | number | boolean | null] }>();
const { t } = useI18n();

const url = ref('');
const isUrlInvalid = computed(() => url.value !== '' && !isSafeLink(url.value));
const fontSize = computed(() => Number.parseInt(props.node.style?.fontSize ?? '', 10) || DEFAULT_FONT_SIZE);
watch(() => props.node, (node) => { url.value = node.hyperLink ?? ''; }, { immediate: true });

function commitUrl(): void {
  if (!isUrlInvalid.value) emit('patch', 'hyperLink', url.value);
}

function onIcon(icon: string): void {
  emit('patch', 'icons', toggleIcon(props.node.icons, icon).join(','));
}

function tagText(): string {
  return (props.node.tags ?? []).map((tag) => (typeof tag === 'string' ? tag : tag.text)).join(', ');
}
</script>

<template>
  <fieldset class="mm-fields" :disabled="disabled">
    <label>{{ t('mindmap.fieldTextColor') }}
      <span class="mm-fields__row">
        <input type="color" :value="node.style?.color ?? '#000000'" @change="emit('patch', 'color', ($event.target as HTMLInputElement).value)" />
        <button type="button" @click="emit('patch', 'color', null)">{{ t('mindmap.fieldClear') }}</button>
      </span>
    </label>
    <label>{{ t('mindmap.fieldBackground') }}
      <span class="mm-fields__row">
        <input type="color" :value="node.style?.background ?? '#ffffff'" @change="emit('patch', 'background', ($event.target as HTMLInputElement).value)" />
        <button type="button" @click="emit('patch', 'background', null)">{{ t('mindmap.fieldClear') }}</button>
      </span>
    </label>
    <label>{{ t('mindmap.fieldFontSize') }} — {{ fontSize }}px
      <input type="range" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" :value="fontSize" @change="emit('patch', 'fontSize', Number(($event.target as HTMLInputElement).value))" />
    </label>
    <label class="mm-fields__inline">
      <input type="checkbox" :checked="node.style?.fontWeight === 'bold'" @change="emit('patch', 'bold', ($event.target as HTMLInputElement).checked)" />
      {{ t('mindmap.fieldBold') }}
    </label>
    <label>{{ t('mindmap.fieldBranchColor') }}
      <span class="mm-fields__row">
        <input type="color" :value="node.branchColor ?? '#888888'" @change="emit('patch', 'branchColor', ($event.target as HTMLInputElement).value)" />
        <button type="button" @click="emit('patch', 'branchColor', null)">{{ t('mindmap.fieldClear') }}</button>
      </span>
    </label>
    <label>{{ t('mindmap.fieldTags') }}
      <input type="text" :value="tagText()" :placeholder="t('mindmap.fieldTagsHint')" @change="emit('patch', 'tags', ($event.target as HTMLInputElement).value)" />
    </label>
    <div>{{ t('mindmap.fieldIcons') }}
      <div class="mm-fields__icons">
        <button v-for="icon in NODE_ICONS" :key="icon" type="button" :aria-pressed="node.icons?.includes(icon) ?? false" @click="onIcon(icon)">{{ icon }}</button>
      </div>
    </div>
    <label>{{ t('mindmap.fieldUrl') }}
      <input v-model="url" type="url" dir="ltr" :aria-invalid="isUrlInvalid" @change="commitUrl" />
      <small v-if="isUrlInvalid" role="alert">{{ t('mindmap.fieldUrlInvalid') }}</small>
    </label>
    <label>{{ t('mindmap.fieldNote') }}
      <textarea rows="6" dir="auto" :value="node.note ?? ''" @change="emit('patch', 'note', ($event.target as HTMLTextAreaElement).value)" />
    </label>
  </fieldset>
</template>

<style scoped>
.mm-fields { display: flex; flex-direction: column; gap: 12px; border: 0; padding: 0; margin: 0; font-size: 12px; }
.mm-fields label { display: flex; flex-direction: column; gap: 4px; }
.mm-fields__inline { flex-direction: row !important; align-items: center; }
.mm-fields__row { display: flex; gap: 8px; align-items: center; }
.mm-fields__icons { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-block-start: 4px; }
.mm-fields__icons button { padding: 4px; border: 1px solid transparent; border-radius: 4px; background: transparent; cursor: pointer; }
.mm-fields__icons button[aria-pressed='true'] { border-color: var(--accent, #4a7); }
.mm-fields input[type='text'], .mm-fields input[type='url'], .mm-fields textarea { width: 100%; box-sizing: border-box; }
</style>
```

- [ ] **Step 2: Side panel container**

```vue
<!-- app/src/components/MindmapSidePanel.vue -->
<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '../i18n';

type PanelTab = 'node' | 'map';
const props = defineProps<{ hasSingleNode: boolean; hasMultipleNodes: boolean }>();
const { t } = useI18n();
const active = ref<PanelTab>(props.hasSingleNode ? 'node' : 'map');
watch(() => props.hasSingleNode, (isSingle) => { active.value = isSingle ? 'node' : 'map'; });
</script>

<template>
  <aside class="mm-panel">
    <div class="mm-panel__tabs" role="tablist">
      <button type="button" role="tab" :aria-selected="active === 'node'" @click="active = 'node'">{{ t('mindmap.panelNode') }}</button>
      <button type="button" role="tab" :aria-selected="active === 'map'" @click="active = 'map'">{{ t('mindmap.panelMap') }}</button>
    </div>
    <div class="mm-panel__body">
      <template v-if="active === 'node'">
        <slot v-if="hasSingleNode" name="node" />
        <p v-else class="mm-panel__hint">{{ t('mindmap.panelSelectOne') }}</p>
      </template>
      <slot v-else name="map" />
    </div>
  </aside>
</template>

<style scoped>
.mm-panel { width: 260px; flex: 0 0 260px !important; display: flex; flex-direction: column; border-inline-start: 1px solid var(--border, #ddd); background: var(--bg-secondary, #f6f6f6); overflow: auto; }
.mm-panel__tabs { display: flex; gap: 2px; padding: 6px; }
.mm-panel__tabs button { flex: 1; padding: 4px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
.mm-panel__tabs button[aria-selected='true'] { border-color: var(--border, #ccc); background: var(--bg, #fff); }
.mm-panel__body { padding: 8px 12px; }
.mm-panel__hint { opacity: 0.7; font-size: 12px; }
</style>
```

- [ ] **Step 3: Wire selection and patches in the shell**

In `MindmapView.vue` script:

```ts
import type { NodeObj } from 'mind-elixir';
import { buildNodePatch, type NodeField } from '../lib/mindmap-node-style';
import MindmapSidePanel from './MindmapSidePanel.vue';
import MindmapNodeFields from './MindmapNodeFields.vue';

const selected = ref<NodeObj[]>([]);
const singleNode = computed(() => (selected.value.length === 1 ? selected.value[0] : null));
const isPanelEditable = computed(() => !(canvas.value?.isReadOnly || canvas.value?.isGraphView));
const isPanelVisible = computed(() => mode.value === 'map' && settings.mindmapPanelOpen);

function applyNodePatch(field: NodeField, value: string | number | boolean | null): void {
  const mind = canvas.value?.getMind();
  const node = singleNode.value;
  if (!mind || !node || !isPanelEditable.value) return;
  const result = buildNodePatch(node, field, value);
  if (!result.ok) {
    toasts.error(t('mindmap.fieldUrlInvalid'));
    return;
  }
  mind.reshapeNode(mind.findEle(node.id), result.patch);
  selected.value = [{ ...node, ...result.patch }];
}
```

In the template, inside `.mindmap-shell__body` after the renderers:

```vue
      <MindmapSidePanel v-if="isPanelVisible" :has-single-node="singleNode !== null" :has-multiple-nodes="selected.length > 1">
        <template #node>
          <p v-if="!isPanelEditable" class="mindmap-shell__hint">{{ t('mindmap.panelReadOnly') }}</p>
          <MindmapNodeFields v-if="singleNode" :node="singleNode" :disabled="!isPanelEditable" @patch="applyNodePatch" />
        </template>
      </MindmapSidePanel>
```

Add `@selection="(nodes) => (selected = nodes)"` to `<MindmapCanvas>`. Add `.mindmap-shell__hint { font-size: 12px; opacity: 0.7; }` to the styles.

The toast in `applyNodePatch` uses the URL message because colors and sizes come from native pickers and cannot be invalid in practice; the URL field already blocks invalid input before emitting.

- [ ] **Step 4: Build**

Run: `cd app && pnpm build`
Expected: success.

- [ ] **Step 5: Browser verification**

1. Toggle panel → Node tab with no selection shows "Select one node"; select a node → fields fill.
2. Change text color, background, font size, bold, branch color → node updates immediately; Cmd+Z undoes each.
3. Tags `a, b` → tags render; icons toggle on and off.
4. URL `javascript:alert(1)` → inline error, nothing written; `https://example.com` → link icon appears.
5. Note text with Hebrew → saved; Source view shows `"note"` on that node.
6. Read-only on → fields disabled with hint.
7. Save, reload → all edits persist.
8. Panel open state survives an app reload.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/MindmapSidePanel.vue app/src/components/MindmapNodeFields.vue app/src/components/MindmapView.vue
git commit -m "feat(mindmap): side panel node tab writing through reshapeNode"
```

---

### Task 8: Side panel — Map tab, display application, Settings defaults

**Files:**
- Create: `app/src/composables/useMindmapDisplay.ts`, `app/src/components/MindmapMapFields.vue`
- Modify: `app/src/components/MindmapView.vue`, `app/src/components/SettingsPanel.vue` (new section in `data-cat="writing"`)

**Interfaces:**
- Consumes: `MapDisplay`, `ResolvedMapDisplay`, `resolveMapDisplay`, `FONT_STACKS`, `straightMainBranch`, `straightSubBranch` (Task 3); canvas `getDisplayOverride` / `setDisplayOverride` / `getMind` (Task 5); settings `mindmapDefaults`, `setMindmapDefaults`, `clearMindmapDefault` (Task 3).
- Produces:
  ```ts
  export function applyMapDisplay(mind: MindElixirInstance, display: ResolvedMapDisplay, original: BranchGenerators): void;
  export interface BranchGenerators { main: MindElixirInstance['generateMainBranch']; sub: MindElixirInstance['generateSubBranch'] }
  export function captureBranchGenerators(mind: MindElixirInstance): BranchGenerators;
  ```
  `<MindmapMapFields :value="MapDisplay" :inherited="MapDisplay" @set="(patch: MapDisplay)" @clear="(key: keyof MapDisplay)" />`

- [ ] **Step 1: Display composable**

```ts
// app/src/composables/useMindmapDisplay.ts
import type { MindElixirInstance } from 'mind-elixir';
import { FONT_STACKS, straightMainBranch, straightSubBranch, type ResolvedMapDisplay } from '../lib/mindmap-display';

const TEXT_COLOR_VAR = '--color';
const FONT_VAR = '--mm-font';

export interface BranchGenerators {
  main: MindElixirInstance['generateMainBranch'];
  sub: MindElixirInstance['generateSubBranch'];
}

export function captureBranchGenerators(mind: MindElixirInstance): BranchGenerators {
  return { main: mind.generateMainBranch, sub: mind.generateSubBranch };
}

function applyBranchStyle(mind: MindElixirInstance, display: ResolvedMapDisplay, original: BranchGenerators): void {
  const isStraight = display.branchStyle === 'straight';
  mind.generateMainBranch = isStraight ? straightMainBranch : original.main;
  mind.generateSubBranch = isStraight ? straightSubBranch : original.sub;
}

function applyText(mind: MindElixirInstance, display: ResolvedMapDisplay): void {
  const style = mind.container.style;
  if (display.textColor) style.setProperty(TEXT_COLOR_VAR, display.textColor);
  else style.removeProperty(TEXT_COLOR_VAR);
  style.setProperty(FONT_VAR, FONT_STACKS[display.font]);
}

export function applyMapDisplay(mind: MindElixirInstance, display: ResolvedMapDisplay, original: BranchGenerators): void {
  applyBranchStyle(mind, display, original);
  applyText(mind, display);
  mind.changeCompact(display.compact);
  mind.linkDiv();
}
```

Add to `MindmapCanvas.vue` scoped styles so the font variable takes effect:

```css
.mindmap-view__canvas :deep(.map-container) { font-family: var(--mm-font, inherit); }
```

Verify in the browser which CSS variable the 5.15.1 theme uses for topic text (inspect `me-tpc` computed `color`; the package theme sets `--color` on the container in 5.x). If it differs, change `TEXT_COLOR_VAR` to that name.

- [ ] **Step 2: Map fields component**

```vue
<!-- app/src/components/MindmapMapFields.vue -->
<script setup lang="ts">
import { useI18n } from '../i18n';
import type { BranchStyle, MapDisplay, MapFont } from '../lib/mindmap-display';

const props = defineProps<{ value: MapDisplay; inherited?: MapDisplay; disabled?: boolean }>();
const emit = defineEmits<{ set: [patch: MapDisplay]; clear: [key: keyof MapDisplay] }>();
const { t } = useI18n();

const BRANCH_OPTIONS: readonly { value: BranchStyle; labelKey: string }[] = [
  { value: 'curve', labelKey: 'mindmap.branchCurve' },
  { value: 'straight', labelKey: 'mindmap.branchStraight' },
];
const FONT_OPTIONS: readonly { value: MapFont; labelKey: string }[] = [
  { value: 'system', labelKey: 'mindmap.fontSystem' },
  { value: 'serif', labelKey: 'mindmap.fontSerif' },
  { value: 'mono', labelKey: 'mindmap.fontMono' },
];

function isInherited(key: keyof MapDisplay): boolean {
  return props.inherited !== undefined && props.value[key] === undefined;
}
</script>

<template>
  <fieldset class="mm-fields" :disabled="disabled">
    <label class="mm-fields__inline">
      <input type="checkbox" :checked="value.compact ?? inherited?.compact ?? false" @change="emit('set', { compact: ($event.target as HTMLInputElement).checked })" />
      {{ t('mindmap.fieldCompact') }}
      <button v-if="inherited && !isInherited('compact')" type="button" @click="emit('clear', 'compact')">{{ t('mindmap.useGlobalDefault') }}</button>
    </label>
    <label>{{ t('mindmap.fieldBranchStyle') }}
      <select :value="value.branchStyle ?? inherited?.branchStyle ?? 'curve'" @change="emit('set', { branchStyle: ($event.target as HTMLSelectElement).value as BranchStyle })">
        <option v-for="o in BRANCH_OPTIONS" :key="o.value" :value="o.value">{{ t(o.labelKey) }}</option>
      </select>
      <button v-if="inherited && !isInherited('branchStyle')" type="button" @click="emit('clear', 'branchStyle')">{{ t('mindmap.useGlobalDefault') }}</button>
    </label>
    <label>{{ t('mindmap.fieldTextColor') }}
      <span class="mm-fields__row">
        <input type="color" :value="value.textColor ?? inherited?.textColor ?? '#000000'" @change="emit('set', { textColor: ($event.target as HTMLInputElement).value })" />
        <button type="button" @click="emit('clear', 'textColor')">{{ inherited ? t('mindmap.useGlobalDefault') : t('mindmap.fieldClear') }}</button>
      </span>
    </label>
    <label>{{ t('mindmap.fieldFont') }}
      <select :value="value.font ?? inherited?.font ?? 'system'" @change="emit('set', { font: ($event.target as HTMLSelectElement).value as MapFont })">
        <option v-for="o in FONT_OPTIONS" :key="o.value" :value="o.value">{{ t(o.labelKey) }}</option>
      </select>
      <button v-if="inherited && !isInherited('font')" type="button" @click="emit('clear', 'font')">{{ t('mindmap.useGlobalDefault') }}</button>
    </label>
  </fieldset>
</template>

<style scoped>
.mm-fields { display: flex; flex-direction: column; gap: 12px; border: 0; padding: 0; margin: 0; font-size: 12px; }
.mm-fields label { display: flex; flex-direction: column; gap: 4px; }
.mm-fields__inline { flex-direction: row !important; align-items: center; gap: 8px !important; }
.mm-fields__row { display: flex; gap: 8px; align-items: center; }
</style>
```

`inherited` is passed only in the side panel (file override over global defaults). In Settings it is omitted, so "Clear" removes the global default.

- [ ] **Step 3: Wire the Map tab in the shell**

In `MindmapView.vue` script:

```ts
import type { MapDisplay } from '../lib/mindmap-display';
import { resolveMapDisplay } from '../lib/mindmap-display';
import { applyMapDisplay, captureBranchGenerators, type BranchGenerators } from '../composables/useMindmapDisplay';
import MindmapMapFields from './MindmapMapFields.vue';

const displayOverride = ref<MapDisplay>({});
let branchGenerators: BranchGenerators | null = null;

function applyDisplay(): void {
  const mind = canvas.value?.getMind();
  if (!mind) return;
  branchGenerators ??= captureBranchGenerators(mind);
  applyMapDisplay(mind, resolveMapDisplay(displayOverride.value, settings.mindmapDefaults), branchGenerators);
}

function onCanvasReady(): void {
  branchGenerators = null;
  displayOverride.value = canvas.value?.getDisplayOverride() ?? {};
  applyDisplay();
}

function setOverride(patch: MapDisplay): void {
  displayOverride.value = { ...displayOverride.value, ...patch };
  canvas.value?.setDisplayOverride(displayOverride.value);
  applyDisplay();
}

function clearOverride(key: keyof MapDisplay): void {
  const next = { ...displayOverride.value };
  delete next[key];
  displayOverride.value = next;
  canvas.value?.setDisplayOverride(next);
  applyDisplay();
}

watch(() => settings.mindmapDefaults, applyDisplay, { deep: true });
```

Add `watch` to the `vue` import. In `MindmapCanvas.vue`, add an emit `ready: []` fired at the end of `mount()` and after `mind.refresh(data)` in `applyExternalContent()`; also refresh `displayOverride` there from the latest parse (already done in `loadData`). In the shell, add `@ready="onCanvasReady"` to `<MindmapCanvas>` and the `#map` slot:

```vue
        <template #map>
          <MindmapMapFields :value="displayOverride" :inherited="settings.mindmapDefaults" :disabled="!isPanelEditable" @set="setOverride" @clear="clearOverride" />
        </template>
```

- [ ] **Step 4: Settings → Mindmap defaults**

In `SettingsPanel.vue`, import `MindmapMapFields` and add a section inside the `writing` category (next to the existing `<section data-cat="writing">` blocks):

```vue
        <section data-cat="writing">
          <h4>{{ t('mindmap.settingsDefaults') }}</h4>
          <MindmapMapFields :value="settings.mindmapDefaults" @set="settings.setMindmapDefaults($event)" @clear="settings.clearMindmapDefault($event)" />
        </section>
```

If the settings search index lists section titles (grep `data-cat="writing"` neighbours for a keywords attribute), add the same attribute pattern with `mindmap`.

- [ ] **Step 5: Build**

Run: `cd app && pnpm build`
Expected: success.

- [ ] **Step 6: Browser verification**

1. Panel Map tab → Compact on → map tightens; save → Source shows `"display": { "compact": true }` on the envelope.
2. Branch style Straight → branches become straight lines on both sides of the root; Curve restores.
3. Text color and font change topic text; Hebrew topics still align RTL.
4. "Use global default" removes the key from `display`; when `display` is empty, it disappears from the file.
5. Settings → Mindmap defaults: set Straight globally → a map without an override switches; a map with `branchStyle: "curve"` override does not.
6. Undo after a node edit does not reset display settings.

- [ ] **Step 7: Commit**

```bash
git add app/src/composables/useMindmapDisplay.ts app/src/components/MindmapMapFields.vue app/src/components/MindmapView.vue app/src/components/MindmapCanvas.vue app/src/components/SettingsPanel.vue
git commit -m "feat(mindmap): map display settings with per-file override and global defaults"
```

---

### Task 9: Multi-select

**Files:**
- Modify: `app/src/components/MindmapCanvas.vue` (only if the probe in Step 1 shows selection is off)

**Interfaces:**
- Consumes: canvas `selection` emit (Task 5), panel `hasMultipleNodes` (Task 7).

- [ ] **Step 1: Probe the package default**

Browser, Map view, editable map with 5+ nodes:
1. Drag on empty canvas with the left button.
2. Shift+click two nodes.

Record in the task report whether a selection box appears and multiple nodes highlight.

- [ ] **Step 2: Enable selection only if the probe failed**

If no box appears, set the package options explicitly in `mount()`:

```ts
    mouseSelectionButton: MOUSE_SELECTION_BUTTON,
    selectionContainer: host.value,
```

with `const MOUSE_SELECTION_BUTTON = 0;` at the top of the script. If the probe passed, change nothing here.

- [ ] **Step 3: Browser verification**

1. Box-select 3 nodes → panel Node tab shows "Select one node".
2. Delete → all 3 removed; Cmd+Z restores all 3.
3. Cmd+C, select another node, Cmd+V → copies pasted (sanitized copy path unchanged).
4. Alt+↑ moves the selection.
5. Gate menu items act on the primary node only; no error with several selected.

- [ ] **Step 4: Commit (only if Step 2 changed code)**

```bash
git add app/src/components/MindmapCanvas.vue
git commit -m "feat(mindmap): enable box multi-select on the map"
```

---

### Task 10: Verification, docs, bump

**Files:**
- Modify: `docs/superpowers/specs/2026-10-12-mindmap-phase7-views-panel-design.md` (Status + spec deltas), `docs/superpowers/specs/2026-10-11-mindmap-design.md` (Phase 7 row), `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/tauri.conf.json`

- [ ] **Step 1: Full unit sweep**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-*.test.ts src/lib/xmind-*.test.ts`
Expected: all pass (the known extensionless-import failures are not in this glob).

- [ ] **Step 2: Rust and build**

Run: `cd app/src-tauri && cargo test fs_file_exists` → PASS.
Run: `cd app && pnpm build` → success.

- [ ] **Step 3: Update docs**

In the Phase 7 spec `## Status`, add: `Done DD-MM-YY (<version>) — plan docs/superpowers/plans/2026-10-12-mindmap-phase7-views-panel.md`, and copy the "Spec deltas" table from this plan under a `## Decisions during planning` heading. In the parent design status table, change the Phase 7 row to `✅ Done DD-MM-YY (<version>)` with the plan path.

- [ ] **Step 4: Bump the patch version**

Read the current version from `app/package.json` and bump the patch number in all three files (`app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/tauri.conf.json`), as in Phases 1–5. Run `cd app/src-tauri && cargo check` so `Cargo.lock` updates.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers app/package.json app/src-tauri/Cargo.toml app/src-tauri/Cargo.lock app/src-tauri/tauri.conf.json
git commit -m "chore(mindmap): phase 7 docs and version bump"
```

- [ ] **Step 6: Desktop check (user)**

Hand off to the user for a Tauri desktop pass before merge: XMind open fix with real files, exports via native dialogs, panel and views in the packaged app.
