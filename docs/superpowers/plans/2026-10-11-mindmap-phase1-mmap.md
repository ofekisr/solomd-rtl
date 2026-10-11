# Mindmap Phase 1 — `.mmap` File Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SoloMD opens, edits, and saves `.mmap` files as XMind-like mindmaps with keyboard shortcuts.

**Architecture:** `.mmap` tabs stay ordinary string tabs with a new `Language = 'mindmap'`, so dirty state, save, AutoGit, and recents are reused. `PaneContent.vue` swaps Editor/Preview for a lazy-loaded `MindmapView.vue` that wraps Mind Elixir and syncs JSON back into `tab.content`. Mindmap-only shortcuts join the existing rebindable table under a new `mindmap` scope that the global dispatcher ignores.

**Tech Stack:** Vue 3.5 + Pinia, TypeScript 5.6, Tauri 2 (Rust), `mind-elixir@5.15.1`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-10-11-mindmap-design.md` (Phase 1 section).

## Global Constraints

- Package manager: `pnpm` inside `app/`. Lockfile `app/pnpm-lock.yaml` must be committed with dependency changes.
- `mind-elixir` pinned to exactly `5.15.1` (no caret).
- No new validation library; boundary checks are hand-written type guards (no `zod` in this repo).
- No `any`; constants for every magic value.
- Tests: `cd app && node --test --experimental-strip-types src/lib/<file>.test.ts`. Test imports use the `.ts` extension.
- Type check + build: `cd app && pnpm build` (`vue-tsc --noEmit && vite build`).
- Rust tests: `cd app/src-tauri && cargo test --test read_file_test`. The pre-existing `detect_language_from_extension` `.rs` assertion is known to fail on `main`; do not fix it here, just confirm no new failures.
- Phase 1 maps only `mmap`. `xmind` joins `MINDMAP_EXTENSIONS` in Phase 2.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Branch: `feat/mindmap`.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `app/src/lib/mindmap-format.ts` | Create | Extensions const, envelope parse/serialize, empty map |
| `app/src/lib/mindmap-format.test.ts` | Create | Format tests |
| `app/src/lib/mindmap-keymap.ts` | Create | Mind Elixir built-in key table (help + event isolation) |
| `app/src/lib/mindmap-keymap.test.ts` | Create | Key table tests |
| `app/src/components/MindmapView.vue` | Create | Mind Elixir mount, sync, theme, scoped shortcuts, error panel |
| `app/src/components/MindmapShortcutHelp.vue` | Create | `?` cheat-sheet overlay |
| `app/src/types.ts` | Modify | `Language` adds `'mindmap'` |
| `app/src/lib/file-language.ts` (+ test) | Modify | Map `mmap` → `mindmap`; `untitledFileName()` |
| `app/src/lib/keybindings.ts` (+ test) | Modify | `scope`, `mindmap` category, `Space` key, scoped resolve/conflict |
| `app/src/composables/useFiles.ts` | Modify | Save filter + untitled name |
| `app/src/components/PaneContent.vue` | Modify | Swap to `MindmapView` |
| `app/src/components/SettingsPanel.vue`, `MarkdownHelp.vue` | Modify | Show `mindmap` key category |
| `app/src/i18n/en.ts` | Modify | New strings (other locales fall back to English) |
| `app/src/components/FileTree.vue` | Modify | `mmap` icon |
| `app/src-tauri/src/commands.rs` | Modify | `detect_language`: `mmap` → `mindmap` |
| `app/src-tauri/src/main.rs` | Modify | Accept `.mmap` open arguments |
| `app/src-tauri/tauri.conf.json` | Modify | `.mmap` file association |
| `app/src-tauri/tests/read_file_test.rs` | Modify | Language test for `.mmap` |

---

### Task 1: Mindmap format module + dependency

**Files:**
- Modify: `app/package.json`, `app/pnpm-lock.yaml`
- Create: `app/src/lib/mindmap-format.ts`
- Test: `app/src/lib/mindmap-format.test.ts`

**Interfaces:**
- Consumes: `MindElixirData`, `NodeObj` types from `mind-elixir` (type-only imports).
- Produces:
  - `MMAP_EXTENSION: 'mmap'`, `MINDMAP_EXTENSIONS: readonly string[]`
  - `isMindmapPath(path: string): boolean`
  - `rootTopicFromFileName(fileName: string): string`
  - `createEmptyMindmap(rootTopic: string): MindElixirData`
  - `serializeMindmap(data: MindElixirData): string`
  - `parseMindmap(text: string, fallbackTopic: string): MindmapParseResult` where `MindmapParseResult = { ok: true; data: MindElixirData; isEmpty: boolean } | { ok: false; error: string }`

- [ ] **Step 1: Install the dependency**

```bash
cd app && pnpm add mind-elixir@5.15.1 --save-exact
```

Expected: `package.json` has `"mind-elixir": "5.15.1"`.

- [ ] **Step 2: Write the failing tests**

`app/src/lib/mindmap-format.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MINDMAP_EXTENSIONS,
  createEmptyMindmap,
  isMindmapPath,
  parseMindmap,
  rootTopicFromFileName,
  serializeMindmap,
} from './mindmap-format.ts';

test('Phase 1 recognizes only .mmap', () => {
  assert.deepEqual([...MINDMAP_EXTENSIONS], ['mmap']);
  assert.equal(isMindmapPath('/notes/Plan.MMAP'), true);
  assert.equal(isMindmapPath('C:\\maps\\plan.mmap'), true);
  assert.equal(isMindmapPath('/notes/plan.md'), false);
  assert.equal(isMindmapPath('mmap'), false);
});

test('root topic comes from the file name without extension', () => {
  assert.equal(rootTopicFromFileName('Project Plan.mmap'), 'Project Plan');
  assert.equal(rootTopicFromFileName('Untitled.mmap'), 'Untitled');
  assert.equal(rootTopicFromFileName(''), 'Untitled');
});

test('serialize then parse round-trips the map', () => {
  const data = createEmptyMindmap('Root');
  data.nodeData.children = [{ id: 'a', topic: 'Child', children: [] }];
  const parsed = parseMindmap(serializeMindmap(data), 'Fallback');
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.isEmpty, false);
  assert.equal(parsed.data.nodeData.topic, 'Root');
  assert.equal(parsed.data.nodeData.children?.[0].topic, 'Child');
});

test('serialized output is a versioned, indented envelope', () => {
  const text = serializeMindmap(createEmptyMindmap('Root'));
  const json = JSON.parse(text);
  assert.equal(json.format, 'solomd-mindmap');
  assert.equal(json.version, 1);
  assert.ok(text.includes('\n  "format"'));
  assert.ok(text.endsWith('\n'));
});

test('empty or whitespace text opens as a new map named after the file', () => {
  const parsed = parseMindmap('  \n', 'Ideas');
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.isEmpty, true);
  assert.equal(parsed.data.nodeData.topic, 'Ideas');
});

test('invalid input returns a typed error instead of throwing', () => {
  const cases = [
    '{not json',
    '{"format":"other","version":1,"data":{"nodeData":{"id":"r","topic":"R"}}}',
    '{"format":"solomd-mindmap","version":2,"data":{"nodeData":{"id":"r","topic":"R"}}}',
    '{"format":"solomd-mindmap","version":1,"data":{}}',
    '{"format":"solomd-mindmap","version":1,"data":{"nodeData":{"id":"r","topic":"R","children":[{"topic":"no id"}]}}}',
  ];
  for (const text of cases) {
    const parsed = parseMindmap(text, 'X');
    assert.equal(parsed.ok, false, text);
    if (!parsed.ok) assert.ok(parsed.error.length > 0);
  }
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-format.test.ts`
Expected: FAIL — `Cannot find module './mindmap-format.ts'`.

- [ ] **Step 4: Implement**

`app/src/lib/mindmap-format.ts`:

```ts
import type { MindElixirData, NodeObj } from 'mind-elixir';

export const MMAP_EXTENSION = 'mmap';
export const MINDMAP_EXTENSIONS: readonly string[] = [MMAP_EXTENSION];

const FORMAT_ID = 'solomd-mindmap';
const FORMAT_VERSION = 1;
const JSON_INDENT = 2;
const ROOT_ID = 'root';
const DEFAULT_ROOT_TOPIC = 'Untitled';

interface MindmapEnvelope {
  format: typeof FORMAT_ID;
  version: typeof FORMAT_VERSION;
  data: MindElixirData;
}

export type MindmapParseResult =
  | { ok: true; data: MindElixirData; isEmpty: boolean }
  | { ok: false; error: string };

function extensionOf(path: string): string {
  const name = path.split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function isMindmapPath(path: string): boolean {
  return MINDMAP_EXTENSIONS.includes(extensionOf(path));
}

export function rootTopicFromFileName(fileName: string): string {
  const name = fileName.split(/[\\/]/).pop() ?? '';
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  return stem.trim() || DEFAULT_ROOT_TOPIC;
}

export function createEmptyMindmap(rootTopic: string): MindElixirData {
  return { nodeData: { id: ROOT_ID, topic: rootTopic, children: [] } };
}

export function serializeMindmap(data: MindElixirData): string {
  const envelope: MindmapEnvelope = { format: FORMAT_ID, version: FORMAT_VERSION, data };
  return `${JSON.stringify(envelope, null, JSON_INDENT)}\n`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNodeObj(value: unknown): value is NodeObj {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || typeof value.topic !== 'string') return false;
  if (value.children === undefined) return true;
  return Array.isArray(value.children) && value.children.every(isNodeObj);
}

function validateEnvelope(value: unknown): string | null {
  if (!isRecord(value)) return 'Mindmap file is not a JSON object';
  if (value.format !== FORMAT_ID) return `Unknown mindmap format: ${String(value.format)}`;
  if (value.version !== FORMAT_VERSION) return `Unsupported mindmap version: ${String(value.version)}`;
  if (!isRecord(value.data) || !isNodeObj(value.data.nodeData)) return 'Mindmap data has no valid root node';
  return null;
}

export function parseMindmap(text: string, fallbackTopic: string): MindmapParseResult {
  if (text.trim() === '') return { ok: true, data: createEmptyMindmap(fallbackTopic), isEmpty: true };
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    return { ok: false, error: `Invalid JSON: ${(err as Error).message}` };
  }
  const error = validateEnvelope(json);
  if (error) return { ok: false, error };
  return { ok: true, data: (json as MindmapEnvelope).data, isEmpty: false };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-format.test.ts`
Expected: 6/6 pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/ofeki/repos/solomd-rtl
git add app/package.json app/pnpm-lock.yaml app/src/lib/mindmap-format.ts app/src/lib/mindmap-format.test.ts
git commit -m "feat(mindmap): add .mmap format module and mind-elixir dependency

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Route `.mmap` files to the `mindmap` language

**Files:**
- Modify: `app/src/types.ts:1` (the `Language` union)
- Modify: `app/src/lib/file-language.ts`
- Test: `app/src/lib/file-language.test.ts`
- Modify: `app/src/composables/useFiles.ts:37-40` (`SAVE_FILTERS`), `:684`, `:782` (untitled names)
- Modify: `app/src/components/FileTree.vue:~1892` (icon map)
- Modify: `app/src-tauri/src/commands.rs` (`detect_language`, ~line 1090)
- Modify: `app/src-tauri/src/main.rs:~78` (open-argument filter)
- Modify: `app/src-tauri/tauri.conf.json` (`bundle.fileAssociations`)
- Test: `app/src-tauri/tests/read_file_test.rs`

**Interfaces:**
- Consumes: `MINDMAP_EXTENSIONS`, `MMAP_EXTENSION` from Task 1.
- Produces: `Language` includes `'mindmap'`; `untitledFileName(language: Language): string`; Rust `read_file` returns `language: "mindmap"` for `.mmap`.

- [ ] **Step 1: Write the failing TS test** (append to `app/src/lib/file-language.test.ts`; change its import to `'./file-language.ts'` and add `untitledFileName`)

```ts
import { inferFileLanguage, untitledFileName } from './file-language.ts';

test('mindmap files route to the mindmap language', () => {
  assert.equal(inferFileLanguage('/maps/Plan.mmap'), 'mindmap');
  assert.equal(inferFileLanguage('C:\\maps\\PLAN.MMAP'), 'mindmap');
});

test('untitled names follow the language', () => {
  assert.equal(untitledFileName('markdown'), 'Untitled.md');
  assert.equal(untitledFileName('mindmap'), 'Untitled.mmap');
  assert.equal(untitledFileName('plaintext'), 'Untitled.txt');
  assert.equal(untitledFileName('python'), 'Untitled.txt');
});
```

- [ ] **Step 2: Write the failing Rust test** (append to `app/src-tauri/tests/read_file_test.rs`)

```rust
#[test]
fn detect_mindmap_language() {
    let path = "/tmp/solomd-lang.mmap".to_string();
    fs::write(&path, "{}").unwrap();
    let r = read_file(path).unwrap();
    assert_eq!(r.language, "mindmap");
}
```

- [ ] **Step 3: Run both to verify they fail**

Run: `cd app && node --test --experimental-strip-types src/lib/file-language.test.ts`
Expected: FAIL (`untitledFileName` not exported / `'plaintext' !== 'mindmap'`).

Run: `cd app/src-tauri && cargo test --test read_file_test detect_mindmap_language`
Expected: FAIL (`left: "plaintext"`, `right: "mindmap"`).

- [ ] **Step 4: Implement TS side**

`app/src/types.ts` — add `'mindmap'` to the union:

```ts
export type Language = 'markdown' | 'mindmap' | 'python' | 'javascript' | 'typescript' | 'rust' | 'html' | 'css' | 'json' | 'cpp' | 'go' | 'sql' | 'java' | 'yaml' | 'xml' | 'bash' | 'plaintext';
```

`app/src/lib/file-language.ts` — import the const, register it, add the helper:

```ts
import type { Language } from '../types';
import { MINDMAP_EXTENSIONS } from './mindmap-format';

const languagesByExtension = new Map<string, Language>([
  // ...existing entries unchanged...
  ...MINDMAP_EXTENSIONS.map((ext): [string, Language] => [ext, 'mindmap']),
]);

const UNTITLED_STEM = 'Untitled';
const untitledExtensionByLanguage: Partial<Record<Language, string>> = {
  markdown: 'md',
  mindmap: 'mmap',
};
const DEFAULT_UNTITLED_EXTENSION = 'txt';

export function untitledFileName(language: Language): string {
  return `${UNTITLED_STEM}.${untitledExtensionByLanguage[language] ?? DEFAULT_UNTITLED_EXTENSION}`;
}
```

`app/src/composables/useFiles.ts`:

```ts
import { MMAP_EXTENSION } from '../lib/mindmap-format';
import { untitledFileName } from '../lib/file-language';

const SAVE_FILTERS = [
  { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
  { name: 'Mindmap', extensions: [MMAP_EXTENSION] },
  { name: 'Plain Text', extensions: ['txt'] },
];
```

Replace both `(tab.language === 'markdown' ? 'Untitled.md' : 'Untitled.txt')` occurrences (in `iosResolvePath` and `saveTabAs`) with `untitledFileName(tab.language)`.

`app/src/components/FileTree.vue` icon map — add after the `'canvas'` entry:

```ts
'mmap': '🧠',
```

- [ ] **Step 5: Implement Rust and Tauri side**

`app/src-tauri/src/commands.rs` in `detect_language`'s `match ext.as_str()` — add after the markdown arm:

```rust
        "mmap" => "mindmap".to_string(),
```

`app/src-tauri/src/main.rs` open-argument filter:

```rust
"md" | "markdown" | "mdown" | "mkd" | "txt" | "mmap"
```

`app/src-tauri/tauri.conf.json` — append to `bundle.fileAssociations`:

```json
{
  "ext": ["mmap"],
  "name": "SoloMD Mindmap",
  "description": "SoloMD mind map",
  "role": "Editor",
  "mimeType": "application/json"
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd app && node --test --experimental-strip-types src/lib/file-language.test.ts src/lib/mindmap-format.test.ts`
Expected: all pass.

Run: `cd app/src-tauri && cargo test --test read_file_test`
Expected: `detect_mindmap_language` passes; only the known `.rs` assertion in `detect_language_from_extension` may fail.

Run: `cd app && pnpm build`
Expected: exit 0. If `vue-tsc` reports a `Record<Language, …>` missing `mindmap`, add a `mindmap` entry at that site (use the `plaintext` value).

- [ ] **Step 7: Commit**

```bash
cd /Users/ofeki/repos/solomd-rtl
git add app/src/types.ts app/src/lib/file-language.ts app/src/lib/file-language.test.ts app/src/composables/useFiles.ts app/src/components/FileTree.vue app/src-tauri/src/commands.rs app/src-tauri/src/main.rs app/src-tauri/tauri.conf.json app/src-tauri/tests/read_file_test.rs
git commit -m "feat(mindmap): route .mmap files to the mindmap language

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Scoped mindmap shortcuts + built-in key table

**Files:**
- Modify: `app/src/lib/keybindings.ts`
- Test: `app/src/lib/keybindings.test.ts`
- Create: `app/src/lib/mindmap-keymap.ts`
- Test: `app/src/lib/mindmap-keymap.test.ts`
- Modify: `app/src/components/SettingsPanel.vue:~106`, `app/src/components/MarkdownHelp.vue:45`
- Modify: `app/src/i18n/en.ts` (`settings` block near `keysCatTools`)

**Interfaces:**
- Consumes: existing `eventToCombo`, `normalizeCombo`, `activeKeyActions`, `combosFor`.
- Produces:
  - `type KeyScope = 'global' | 'mindmap'`; `KeyActionDef.scope?: KeyScope`; `KeyActionDef.category` adds `'mindmap'`
  - `resolveBindings(overrides?, scope: KeyScope = 'global'): Map<KeyCombo, string>`
  - `conflictFor` only reports clashes within the same scope
  - `eventToCombo` returns `Space` for the space bar
  - Action ids: `mindmap.toggleNode` (`Space`), `mindmap.fit` (`Mod+Alt+0`), `mindmap.focusRoot` (`Home`), `mindmap.shortcutHelp` (`Shift+Slash`)
  - `MINDMAP_BUILTIN_KEYS: readonly MindmapBuiltinKey[]` with `{ combo: KeyCombo; label: string }`, and `MINDMAP_BUILTIN_COMBOS: ReadonlySet<KeyCombo>`

- [ ] **Step 1: Write the failing tests**

Append to `app/src/lib/keybindings.test.ts` (extend its import list with `resolveBindings, conflictFor, eventToCombo`):

```ts
import { resolveBindings, conflictFor, eventToCombo } from './keybindings.ts';

function keyEvent(init: Partial<KeyboardEvent>): KeyboardEvent {
  return { ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false, code: '', key: '', ...init } as KeyboardEvent;
}

test('mindmap actions never reach the global dispatcher', () => {
  const global = resolveBindings({});
  for (const id of global.values()) assert.ok(!id.startsWith('mindmap.'), id);
});

test('mindmap scope resolves its own defaults', () => {
  const scoped = resolveBindings({}, 'mindmap');
  assert.equal(scoped.get('Space'), 'mindmap.toggleNode');
  assert.equal(scoped.get('Mod+Alt+0'), 'mindmap.fit');
  assert.equal(scoped.get('Home'), 'mindmap.focusRoot');
  assert.equal(scoped.get('Shift+Slash'), 'mindmap.shortcutHelp');
  for (const id of scoped.values()) assert.ok(id.startsWith('mindmap.'), id);
});

test('conflicts are reported only within one scope', () => {
  assert.equal(conflictFor('Mod+Shift+R', 'mindmap.fit', {}), null);
  assert.equal(conflictFor('Space', 'mindmap.fit', {}), 'mindmap.toggleNode');
});

test('space bar and question mark produce bindable combos', () => {
  assert.equal(eventToCombo(keyEvent({ key: ' ', code: 'Space' })), 'Space');
  assert.equal(eventToCombo(keyEvent({ key: '?', code: 'Slash', shiftKey: true })), 'Shift+Slash');
  assert.equal(eventToCombo(keyEvent({ key: 'º', code: 'Digit0', altKey: true, metaKey: true })), 'Mod+Alt+0');
});
```

`app/src/lib/mindmap-keymap.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeCombo, resolveBindings } from './keybindings.ts';
import { MINDMAP_BUILTIN_COMBOS, MINDMAP_BUILTIN_KEYS } from './mindmap-keymap.ts';

test('every built-in combo is already normalized', () => {
  for (const { combo } of MINDMAP_BUILTIN_KEYS) assert.equal(normalizeCombo(combo), combo);
});

test('the combo set mirrors the table', () => {
  assert.equal(MINDMAP_BUILTIN_COMBOS.size, MINDMAP_BUILTIN_KEYS.length);
});

test('scoped mindmap defaults do not shadow Mind Elixir built-ins', () => {
  for (const combo of resolveBindings({}, 'mindmap').keys()) {
    assert.ok(!MINDMAP_BUILTIN_COMBOS.has(combo), combo);
  }
});

test('core editing keys are covered', () => {
  for (const combo of ['Tab', 'Enter', 'F2', 'Delete', 'Mod+Z', 'Mod+K']) {
    assert.ok(MINDMAP_BUILTIN_COMBOS.has(combo), combo);
  }
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd app && node --test --experimental-strip-types src/lib/keybindings.test.ts src/lib/mindmap-keymap.test.ts`
Expected: FAIL (mindmap ids absent, `Space` not produced, `mindmap-keymap.ts` missing).

- [ ] **Step 3: Implement scope in `keybindings.ts`**

Type changes:

```ts
export type KeyScope = 'global' | 'mindmap';

export interface KeyActionDef {
  id: string;
  label: string;
  category: 'file' | 'edit' | 'view' | 'navigate' | 'tools' | 'mindmap';
  defaults: KeyCombo[];
  platforms?: ('mac' | 'windows' | 'linux')[];
  /** Where the chord is live. Omitted means everywhere (the window dispatcher). */
  scope?: KeyScope;
}

function scopeOf(action: KeyActionDef): KeyScope {
  return action.scope ?? 'global';
}
```

Append to `KEY_ACTIONS`:

```ts
  // ---- Mindmap (live only while a mindmap view has focus) ----
  { id: 'mindmap.toggleNode', label: 'Mindmap: Collapse / Expand Node', category: 'mindmap', scope: 'mindmap', defaults: ['Space'] },
  { id: 'mindmap.fit', label: 'Mindmap: Fit to Window', category: 'mindmap', scope: 'mindmap', defaults: ['Mod+Alt+0'] },
  { id: 'mindmap.focusRoot', label: 'Mindmap: Select Root', category: 'mindmap', scope: 'mindmap', defaults: ['Home'] },
  { id: 'mindmap.shortcutHelp', label: 'Mindmap: Keyboard Shortcuts', category: 'mindmap', scope: 'mindmap', defaults: ['Shift+Slash'] },
```

`eventToCombo` — add before the `raw.length === 1` branch:

```ts
  } else if (raw === ' ') {
    key = 'Space';
```

`resolveBindings` — add the scope parameter and filter:

```ts
export function resolveBindings(
  overrides: Record<string, string | null | undefined> = {},
  scope: KeyScope = 'global',
): Map<KeyCombo, string> {
  const map = new Map<KeyCombo, string>();
  for (const action of activeKeyActions()) {
    if (scopeOf(action) !== scope) continue;
    // ...existing body unchanged...
  }
  return map;
}
```

`conflictFor` — compare only within the target action's scope:

```ts
export function conflictFor(
  combo: KeyCombo,
  actionId: string,
  overrides: Record<string, string | null | undefined> = {},
): string | null {
  const target = normalizeCombo(combo);
  const actions = activeKeyActions();
  const owner = actions.find((a) => a.id === actionId);
  const scope = owner ? scopeOf(owner) : 'global';
  for (const action of actions) {
    if (action.id === actionId || scopeOf(action) !== scope) continue;
    if (combosFor(action.id, overrides).includes(target)) return action.id;
  }
  return null;
}
```

- [ ] **Step 4: Create `app/src/lib/mindmap-keymap.ts`**

Combos below are exactly what Mind Elixir 5.15.1's keypress plugin handles (verified in `dist/MindElixir.js`).

```ts
import type { KeyCombo } from './keybindings';

export interface MindmapBuiltinKey {
  combo: KeyCombo;
  label: string;
}

export const MINDMAP_BUILTIN_KEYS: readonly MindmapBuiltinKey[] = [
  { combo: 'Tab', label: 'Add child' },
  { combo: 'Enter', label: 'Add sibling after' },
  { combo: 'Shift+Enter', label: 'Add sibling before' },
  { combo: 'Mod+Enter', label: 'Insert parent' },
  { combo: 'F2', label: 'Edit topic' },
  { combo: 'Delete', label: 'Remove node' },
  { combo: 'Backspace', label: 'Remove node' },
  { combo: 'ArrowUp', label: 'Select previous' },
  { combo: 'ArrowDown', label: 'Select next' },
  { combo: 'ArrowLeft', label: 'Select left' },
  { combo: 'ArrowRight', label: 'Select right' },
  { combo: 'Alt+ArrowUp', label: 'Move node up' },
  { combo: 'Alt+ArrowDown', label: 'Move node down' },
  { combo: 'PageUp', label: 'Move node up' },
  { combo: 'PageDown', label: 'Move node down' },
  { combo: 'Mod+ArrowLeft', label: 'Layout: all left' },
  { combo: 'Mod+ArrowRight', label: 'Layout: all right' },
  { combo: 'Mod+ArrowUp', label: 'Layout: both sides' },
  { combo: 'F1', label: 'Center map' },
  { combo: 'Mod+Equal', label: 'Zoom in' },
  { combo: 'Mod+Minus', label: 'Zoom out' },
  { combo: 'Mod+0', label: 'Reset zoom' },
  { combo: 'Mod+K', label: 'Then 0 collapse all, = expand all, 1–9 expand to level' },
  { combo: 'Mod+Z', label: 'Undo' },
  { combo: 'Mod+Shift+Z', label: 'Redo' },
  { combo: 'Mod+Y', label: 'Redo' },
  { combo: 'Mod+C', label: 'Copy subtree' },
  { combo: 'Mod+X', label: 'Cut subtree' },
  { combo: 'Mod+V', label: 'Paste subtree' },
];

export const MINDMAP_BUILTIN_COMBOS: ReadonlySet<KeyCombo> = new Set(
  MINDMAP_BUILTIN_KEYS.map((k) => k.combo),
);
```

Note: `Delete`/`Backspace` and the two "Move node up/down" pairs are separate combos, so the set size equals the table length.

- [ ] **Step 5: Show the category in Settings and Help, add strings**

`app/src/components/SettingsPanel.vue` (~line 106):

```ts
  return (['file', 'edit', 'view', 'navigate', 'tools', 'mindmap'] as const)
```

`app/src/components/MarkdownHelp.vue:45`:

```ts
const CATEGORY_ORDER: KeyActionDef['category'][] = ['file', 'edit', 'view', 'navigate', 'tools', 'mindmap'];
```

`app/src/i18n/en.ts` — after `keysCatTools: 'Tools',` in the `settings` block:

```ts
    keysCatMindmap: 'Mindmap',
```

And a new top-level `mindmap` namespace (next to `whiteboard`):

```ts
  mindmap: {
    parseError: 'This mindmap file could not be read.',
    openAsText: 'Open as text',
    shortcutsTitle: 'Mindmap shortcuts',
    builtinSection: 'Editing',
    customSection: 'SoloMD (rebindable in Settings)',
    close: 'Close',
  },
```

- [ ] **Step 6: Run tests and type check**

Run: `cd app && node --test --experimental-strip-types src/lib/keybindings.test.ts src/lib/mindmap-keymap.test.ts`
Expected: all pass, including the pre-existing keybindings tests.

Run: `cd app && pnpm build`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
cd /Users/ofeki/repos/solomd-rtl
git add app/src/lib/keybindings.ts app/src/lib/keybindings.test.ts app/src/lib/mindmap-keymap.ts app/src/lib/mindmap-keymap.test.ts app/src/components/SettingsPanel.vue app/src/components/MarkdownHelp.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): add scoped, rebindable mindmap shortcuts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `MindmapView` and pane swap

**Files:**
- Create: `app/src/components/MindmapView.vue`
- Create: `app/src/components/MindmapShortcutHelp.vue`
- Modify: `app/src/components/PaneContent.vue`

**Interfaces:**
- Consumes: `parseMindmap`, `serializeMindmap`, `rootTopicFromFileName` (Task 1); `resolveBindings`, `combosFor`, `formatCombo`, `eventToCombo`, `activeKeyActions` (Task 3); `MINDMAP_BUILTIN_KEYS`, `MINDMAP_BUILTIN_COMBOS` (Task 3); `themeFamily` from `lib/themes.ts`; `useTabsStore().setContent(id, content)`; window event `solomd:flush-content-sync`.
- Produces: `<MindmapView :tab="tab" />` component; `layoutDirectionFor(data: MindElixirData): 0 | 1 | 2 | 3` in `app/src/lib/mindmap-direction.ts`.

**Hebrew / RTL requirements (spec "Hebrew / RTL"):** stored `data.direction` wins; otherwise RTL-dominant maps (by `documentDirection` over all topics) open `LEFT` (0), others `SIDE` (2). Topics and the edit box use `unicode-bidi: plaintext; text-align: start`.

- [ ] **Step 0: RTL layout helper (TDD)**

`app/src/lib/mindmap-direction.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layoutDirectionFor, MINDMAP_LAYOUT } from './mindmap-direction.ts';
import { createEmptyMindmap } from './mindmap-format.ts';

test('a stored direction always wins', () => {
  const data = { ...createEmptyMindmap('תוכנית'), direction: MINDMAP_LAYOUT.RIGHT };
  assert.equal(layoutDirectionFor(data), MINDMAP_LAYOUT.RIGHT);
});

test('hebrew-dominant maps without a stored direction grow leftward', () => {
  const data = createEmptyMindmap('תוכנית עבודה');
  data.nodeData.children = [{ id: 'a', topic: 'משימה ראשונה API', children: [] }];
  assert.equal(layoutDirectionFor(data), MINDMAP_LAYOUT.LEFT);
});

test('latin-dominant maps default to both sides', () => {
  const data = createEmptyMindmap('Project plan');
  data.nodeData.children = [{ id: 'a', topic: 'שלב one two three', children: [] }];
  assert.equal(layoutDirectionFor(data), MINDMAP_LAYOUT.SIDE);
});
```

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-direction.test.ts` → FAIL (module missing).

`app/src/lib/mindmap-direction.ts`:

```ts
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { documentDirection } from './doc-direction.ts';

export const MINDMAP_LAYOUT = { LEFT: 0, RIGHT: 1, SIDE: 2, DOWN: 3 } as const;
type MindmapLayout = (typeof MINDMAP_LAYOUT)[keyof typeof MINDMAP_LAYOUT];

function collectTopics(node: NodeObj, out: string[]): string[] {
  out.push(node.topic);
  for (const child of node.children ?? []) collectTopics(child, out);
  return out;
}

export function layoutDirectionFor(data: MindElixirData): MindmapLayout {
  if (data.direction !== undefined) return data.direction;
  const text = collectTopics(data.nodeData, []).join('\n');
  return documentDirection(text) === 'rtl' ? MINDMAP_LAYOUT.LEFT : MINDMAP_LAYOUT.SIDE;
}
```

If `doc-direction.ts` cannot be loaded by node tests, check its imports; it has none today. Run the test again → PASS. Commit with the Task 4 commit at the end (stage both files).

- [ ] **Step 1: Create `MindmapShortcutHelp.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../i18n';
import { useSettingsStore } from '../stores/settings';
import { activeKeyActions, combosFor, formatCombo } from '../lib/keybindings';
import { MINDMAP_BUILTIN_KEYS } from '../lib/mindmap-keymap';
import { isMacOS } from '../lib/platform';

const emit = defineEmits<{ (e: 'close'): void }>();
const { t } = useI18n();
const settings = useSettingsStore();
const isMac = isMacOS();

const builtinRows = computed(() =>
  MINDMAP_BUILTIN_KEYS.map((k) => ({ keys: formatCombo(k.combo, isMac), label: k.label })),
);
const customRows = computed(() =>
  activeKeyActions()
    .filter((a) => a.scope === 'mindmap')
    .map((a) => ({
      keys: combosFor(a.id, settings.keybindings).map((c) => formatCombo(c, isMac)).join(' / ') || '—',
      label: a.label.replace(/^Mindmap: /, ''),
    })),
);
</script>

<template>
  <div class="mm-help" role="dialog" :aria-label="t('mindmap.shortcutsTitle')" @click.self="emit('close')">
    <div class="mm-help__card">
      <header class="mm-help__head">
        <h3>{{ t('mindmap.shortcutsTitle') }}</h3>
        <button type="button" @click="emit('close')">{{ t('mindmap.close') }}</button>
      </header>
      <h4>{{ t('mindmap.builtinSection') }}</h4>
      <dl><template v-for="row in builtinRows" :key="row.keys + row.label"><dt>{{ row.keys }}</dt><dd>{{ row.label }}</dd></template></dl>
      <h4>{{ t('mindmap.customSection') }}</h4>
      <dl><template v-for="row in customRows" :key="row.label"><dt>{{ row.keys }}</dt><dd>{{ row.label }}</dd></template></dl>
    </div>
  </div>
</template>

<style scoped>
.mm-help { position: absolute; inset: 0; display: grid; place-items: center; background: rgb(0 0 0 / 0.35); z-index: 20; }
.mm-help__card { background: var(--bg, #fff); color: var(--text, #222); border-radius: 8px; padding: 16px 20px; max-height: 80%; overflow: auto; min-width: 320px; }
.mm-help__head { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0 0 12px; }
dt { font-family: var(--font-mono, monospace); white-space: nowrap; }
dd { margin: 0; }
</style>
```

If `isMacOS` is not exported from `lib/platform.ts`, use the same helper `SettingsPanel.vue` imports for `macKeys`.

- [ ] **Step 2: Create `MindmapView.vue`**

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import MindElixir from 'mind-elixir';
import type { MindElixirData, MindElixirInstance } from 'mind-elixir';
import 'mind-elixir/style.css';
import type { Tab } from '../types';
import { useTabsStore } from '../stores/tabs';
import { useSettingsStore } from '../stores/settings';
import { useI18n } from '../i18n';
import { parseMindmap, rootTopicFromFileName, serializeMindmap } from '../lib/mindmap-format';
import { eventToCombo, resolveBindings } from '../lib/keybindings';
import { MINDMAP_BUILTIN_COMBOS } from '../lib/mindmap-keymap';
import { themeFamily } from '../lib/themes';
import MindmapShortcutHelp from './MindmapShortcutHelp.vue';

const SYNC_DEBOUNCE_MS = 300;
const TOPIC_EDITOR_ID = 'input-box';

const props = defineProps<{ tab: Tab }>();
const tabs = useTabsStore();
const settings = useSettingsStore();
const { t } = useI18n();

const host = ref<HTMLElement | null>(null);
const parseError = ref<string | null>(null);
const isHelpOpen = ref(false);
let mind: MindElixirInstance | null = null;
let lastSynced = props.tab.content;
let syncTimer: number | null = null;

function themeFor(): typeof MindElixir.THEME {
  return themeFamily(settings.theme) === 'dark' ? MindElixir.DARK_THEME : MindElixir.THEME;
}

function loadData(): MindElixirData | null {
  const parsed = parseMindmap(props.tab.content, rootTopicFromFileName(props.tab.fileName));
  if (!parsed.ok) {
    parseError.value = parsed.error;
    return null;
  }
  parseError.value = null;
  return parsed.data;
}

function syncNow(): void {
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = null;
  if (!mind) return;
  lastSynced = serializeMindmap(mind.getData());
  tabs.setContent(props.tab.id, lastSynced);
}

function scheduleSync(): void {
  if (syncTimer !== null) window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(syncNow, SYNC_DEBOUNCE_MS);
}

function mount(): void {
  const data = loadData();
  if (!host.value || !data) return;
  mind = new MindElixir({
    el: host.value,
    direction: MindElixir.SIDE,
    editable: true,
    contextMenu: true,
    toolBar: true,
    keypress: true,
    allowUndo: true,
    theme: themeFor(),
  });
  mind.init(data);
  mind.bus.addListener('operation', scheduleSync);
}

function toggleCurrentNode(): void {
  const node = mind?.currentNode;
  if (!mind || !node?.nodeObj.children?.length) return;
  mind.expandNode(node, node.nodeObj.expanded === false);
}

function selectRoot(): void {
  if (!mind) return;
  mind.selectNode(MindElixir.E(mind.nodeData.id));
  mind.toCenter();
}

const actions: Record<string, () => void> = {
  'mindmap.toggleNode': toggleCurrentNode,
  'mindmap.fit': () => mind?.scaleFit(),
  'mindmap.focusRoot': selectRoot,
  'mindmap.shortcutHelp': () => { isHelpOpen.value = true; },
};

function isEditingTopic(e: KeyboardEvent): boolean {
  return e.target instanceof HTMLElement && e.target.id === TOPIC_EDITOR_ID;
}

function onKeydown(e: KeyboardEvent): void {
  const combo = eventToCombo(e);
  if (!combo || isEditingTopic(e)) return;
  const actionId = resolveBindings(settings.keybindings, 'mindmap').get(combo);
  const run = actionId ? actions[actionId] : undefined;
  if (run) {
    e.preventDefault();
    e.stopPropagation();
    run();
    return;
  }
  if (MINDMAP_BUILTIN_COMBOS.has(combo)) e.stopPropagation();
}

function openAsText(): void {
  props.tab.language = 'plaintext';
}

watch(() => props.tab.content, (content) => {
  if (content === lastSynced || !mind) return;
  lastSynced = content;
  const data = loadData();
  if (data) mind.refresh(data);
});

watch(() => settings.theme, () => mind?.changeTheme(themeFor()));

onMounted(() => {
  mount();
  window.addEventListener('solomd:flush-content-sync', syncNow);
});

onBeforeUnmount(() => {
  window.removeEventListener('solomd:flush-content-sync', syncNow);
  if (syncTimer !== null) syncNow();
  mind?.destroy();
  mind = null;
});
</script>

<template>
  <div class="mindmap-view" @keydown="onKeydown">
    <div v-if="parseError" class="mindmap-view__error" role="alert">
      <p>{{ t('mindmap.parseError') }}</p>
      <pre>{{ parseError }}</pre>
      <button type="button" @click="openAsText">{{ t('mindmap.openAsText') }}</button>
    </div>
    <div v-else ref="host" class="mindmap-view__canvas" />
    <MindmapShortcutHelp v-if="isHelpOpen" @close="isHelpOpen = false" />
  </div>
</template>

<style scoped>
.mindmap-view { position: relative; width: 100%; height: 100%; }
.mindmap-view__canvas { width: 100%; height: 100%; }
.mindmap-view__error { padding: 24px; }
.mindmap-view__error pre { white-space: pre-wrap; opacity: 0.8; }
</style>
```

Notes for the implementer:
- `syncNow` runs on `solomd:flush-content-sync`, which `saveTab` dispatches before reading `tab.content`, so ⌘S never misses the last edit.
- An empty `.mmap` is not marked dirty until the first edit, because `lastSynced` starts as the original (empty) content.
- `tabs.setContent` is the only write path; `lastSynced` breaks the view → store → watch → refresh loop.
- If `vue-tsc` rejects `MindElixir.E`, `selectNode`, `expandNode`, or `destroy` signatures, check `node_modules/mind-elixir/dist/types/index.d.ts` and adapt the call, not the behavior.
- The parse-error branch keeps the raw file untouched; "Open as text" switches the tab to the plain editor.

- [ ] **Step 3: Swap the pane in `PaneContent.vue`**

Script additions:

```ts
import { defineAsyncComponent } from 'vue';

const MindmapView = defineAsyncComponent(() => import('./MindmapView.vue'));

const isMindmap = computed(() => props.tab?.language === 'mindmap');

const showEditor = computed(
  () => !isMindmap.value && (props.tab?.language !== 'markdown' || settings.viewMode !== 'preview')
);
```

Template — add as the first child of `.pane-content`:

```vue
    <div class="pane pane--mindmap" v-if="isMindmap && tab">
      <MindmapView :key="tab.id" :tab="tab" />
    </div>
```

`showPreview` already requires `language === 'markdown'`, so it needs no change.

- [ ] **Step 4: Type check and build**

Run: `cd app && pnpm build`
Expected: exit 0; Vite output lists a separate chunk containing `MindmapView`.

- [ ] **Step 5: Commit**

```bash
cd /Users/ofeki/repos/solomd-rtl
git add app/src/components/MindmapView.vue app/src/components/MindmapShortcutHelp.vue app/src/components/PaneContent.vue
git commit -m "feat(mindmap): edit .mmap files in a Mind Elixir view

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: End-to-end verification and spec sync

**Files:**
- Modify: `docs/superpowers/specs/2026-10-11-mindmap-design.md` (keyboard shortcuts section)

- [ ] **Step 1: Run every affected test**

```bash
cd app && node --test --experimental-strip-types src/lib/mindmap-format.test.ts src/lib/mindmap-keymap.test.ts src/lib/keybindings.test.ts src/lib/file-language.test.ts
```

Expected: all pass.

```bash
cd app/src-tauri && cargo test --test read_file_test
```

Expected: `detect_mindmap_language` passes; no failures besides the known `.rs` assertion.

- [ ] **Step 2: Desktop check in the Tauri dev build**

```bash
cd app && pnpm tauri dev
```

Verify each item and record pass/fail:

1. Create an empty file `~/tmp/mm-check/plan.mmap` from the file tree and open it → a map with root "plan"; the tab is not dirty.
2. Select root, press Tab, type "Child", Enter → child appears; tab becomes dirty.
3. Enter, Shift+Enter, Mod+Enter, F2, Delete, Mod+Z, Mod+Shift+Z behave per the built-in table.
4. Space collapses/expands a node with children; Mod+Alt+0 fits; Home selects the root; `?` opens the cheat sheet.
5. Mod+K while the map has focus does not trigger the global Mod+K action.
6. ⌘S saves; reopen the file → identical map; `cat plan.mmap` shows the `solomd-mindmap` envelope.
7. Switch theme light ↔ dark → map theme follows.
8. Put `{bad` into a `.mmap` → error panel; "Open as text" shows the raw text.
9. Opening `.md` files still shows Editor/Preview exactly as before.

- [ ] **Step 3: Sync the spec's shortcut tables with what shipped**

In the spec's "Keyboard shortcuts" section:
- Replace the built-in table with the rows from `MINDMAP_BUILTIN_KEYS` (adds Mod+K chords, Alt+Arrow moves, Mod+Arrow layouts, Mod+Y).
- Replace `mindmap.expandAll` / `mindmap.collapseAll` with a note that Mind Elixir's Mod+K → `=` / `0` chords cover them.
- Set `mindmap.fit` to `Mod+Alt+0` and `mindmap.shortcutHelp` to `Shift+Slash` (`?`).
- Record that scoped shortcuts shadow global chords only while a mindmap has focus.

- [ ] **Step 4: Commit**

```bash
cd /Users/ofeki/repos/solomd-rtl
git add docs/superpowers/specs/2026-10-11-mindmap-design.md
git commit -m "docs(spec): sync mindmap shortcuts with Phase 1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
