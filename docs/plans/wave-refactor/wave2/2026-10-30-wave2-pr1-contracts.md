# Wave 2 PR-1 — EditorFeature contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `EditorFeature` contract, the registry service, the `useEditorFeatures` host composable and an empty `shell/editor-registry.service.ts` — no callers.

**Architecture:** Features are plain TS objects (no `vue`). The registry orders their extensions by `EXTENSION_SLOTS` rank. `useEditorFeatures` (Vue) owns compartments and one reconfigure watcher (ADR 0004).

**Tech Stack:** TypeScript, CodeMirror 6 (`@codemirror/state`, `@codemirror/view`), Vue 3 `watch`/`effectScope`, Zod, `node --test`.

**Spec:** `docs/design/wave-refactor/2026-10-30-wave2-editor-lld.md` §PR-1, `docs/design/adr/0004-editor-feature-registry.md`.

## Global Constraints

- No behavior change; no caller of anything in this PR.
- Features and `.service.ts` files import no `vue`/`pinia` (type-only imports allowed).
- Local imports carry the `.ts` extension (Node type-stripping tests).
- Each new `.ts` ≤ 400 lines. No `any`.
- Workers never commit; the controller commits per task.
- `ctx.run` is wired by the host to `registry.command(name)(ctx, ...args)`; `useEditorFeatures` does not create the context.
- `pnpm --dir app guard` green after each task.

---

### Task 1: Port, manifest schema, test helpers

**Files:**
- Create: `app/src/features/editor/contracts/editor-feature.port.ts`
- Create: `app/src/features/editor/contracts/editor-api.port.ts`
- Create: `app/src/features/editor/contracts/index.ts`
- Create: `app/src/features/editor/internal/cm-probe.ts`
- Modify: `app/src/stores/settings.ts:575` (`function defaults()` → `export function defaults()`; no line added)
- Test: `app/src/features/editor/contracts/editor-feature.port.test.ts`

**Interfaces — Produces:** everything below, used by every later PR.

- [ ] **Step 1: Write the port**

```ts
// editor-feature.port.ts
import type { Compartment, Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { z } from 'zod';
import type { useSettingsStore } from '../../../stores/settings.ts';
import type { Tab } from '../../../types.ts';
import type { CitationEntry } from '../../../lib/citations.ts';

/** Today's buildExtensions() positions, in order (Editor.vue 3026-3145). ADR 0004. */
export const EXTENSION_SLOTS = [
  'ime-guard', 'history', 'direction', 'drag-aware', 'cursor', 'active-line', 'selection-tools',
  'search', 'keymap', 'line-numbers', 'wrap', 'language', 'rich', 'theme', 'vim', 'font',
  'spellcheck-attr', 'ai-lock', 'focus', 'typewriter', 'image-paste', 'md-completion', 'ai-key',
  'md-spellcheck', 'slash', 'task-list', 'fold', 'session', 'stable-click', 'update-listener',
] as const;
export type ExtensionSlot = (typeof EXTENSION_SLOTS)[number];

export type SettingsStore = ReturnType<typeof useSettingsStore>;
export type ViewLike = Pick<EditorView, 'state' | 'dispatch' | 'focus'>;

export interface EditorProps {
  focusMode: boolean;
  typewriterMode: boolean;
  spellCheck: boolean;
}

export interface EditorFeatureContext {
  tab(): Tab;
  props(): EditorProps;
  readonly settings: SettingsStore;
  themeMode(): 'light' | 'dark';
  t(key: string, params?: Record<string, string | number>): string;
  setContent(tabId: string, text: string): void;
  findTab(id: string): Tab | undefined;
  activeTabId(): string | null;
  readonly toast: { info(m: string): void; success(m: string): void; error(m: string): void };
  view(): EditorView | null;
  /** Run another feature's command (e.g. image-upload → format's insertMarkdown). */
  run(command: string, ...args: unknown[]): unknown;
  /** Bibliography entries for @-completion (host loads them; both engines read them). */
  citations(): CitationEntry[];
}

export interface ReconfigurableSlot {
  readonly slot: ExtensionSlot;
  deps(ctx: EditorFeatureContext): unknown;
  build(ctx: EditorFeatureContext): Extension;
  when?(ctx: EditorFeatureContext): boolean;
  after?(ctx: EditorFeatureContext, view: EditorView | null): void;
}

export interface FeatureWatch {
  deps(ctx: EditorFeatureContext): unknown;
  run(ctx: EditorFeatureContext, view: EditorView | null): void;
}

type Bivariant<F extends (...args: never[]) => unknown> = { fn(...args: Parameters<F>): ReturnType<F> }['fn'];
export type EditorCommand = Bivariant<(ctx: EditorFeatureContext, ...args: unknown[]) => unknown>;

export interface TabSwitch { oldId?: string; newId: string }

export interface EditorFeature {
  readonly id: string;
  readonly settingsKeys: readonly string[];
  readonly i18nKeys: readonly string[];
  readonly extensions?: Partial<Record<ExtensionSlot, (ctx: EditorFeatureContext) => Extension>>;
  readonly slots?: readonly ReconfigurableSlot[];
  readonly watches?: readonly FeatureWatch[];
  readonly commands?: Readonly<Record<string, EditorCommand>>;
  setup?(ctx: EditorFeatureContext): void | (() => void);
  onMount?(ctx: EditorFeatureContext, view: EditorView): void;
  /** Tab switch, before the host replaces the state (old doc still in the view). */
  beforeTabSwitch?(ctx: EditorFeatureContext, view: EditorView, ids: TabSwitch): void;
  /** Tab switch, after the host replaced the state. */
  onTabSwitch?(ctx: EditorFeatureContext, view: EditorView, ids: TabSwitch): void;
  onUnmount?(ctx: EditorFeatureContext, view: EditorView): void;
}

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const EditorFeatureManifestSchema = z.object({
  id: z.string().regex(KEBAB),
  settingsKeys: z.array(z.string().min(1)),
  i18nKeys: z.array(z.string().min(1)),
});

export type CompartmentFor = (key: string) => Compartment;
```

```ts
// editor-api.port.ts — Editor.vue defineExpose (line 4250), today's signatures
export interface LineSelection { fromLine: number; toLine: number; headLine: number; isEmpty: boolean }
export type FoldAction = 'toggle' | 'all' | 'none' | 'level';
export interface EditorApi {
  getLineSelection(): LineSelection | null;
  gotoLine(line: number): void;
  insertImageFromPath(srcPath: string): Promise<void>;
  insertImageUrl(url: string, alt?: string): void;
  uploadLocalImages(): Promise<void>;
  getViewLine(): number | null;
  scrollToLine(line: number): void;
  lineTopY(line: number): number | null;
  insertMarkdown(snippet: string): void;
  openFind(): void;
  applyFold(action: FoldAction, level?: number): void;
  openTableAtCursor(): void;
  openFormulaAtCursor(): void;
}
export interface DocAccess {
  getDoc(): string;
  getCaret(): number;
  replaceRange(from: number, to: number, text: string): void;
}
```

```ts
// contracts/index.ts
export * from './editor-feature.port.ts';
export * from './editor-api.port.ts';
```

- [ ] **Step 2: Write `cm-probe.ts`**

```ts
import { EditorState, type Extension, type TransactionSpec } from '@codemirror/state';
import type { EditorFeatureContext, EditorProps, ViewLike } from '../contracts/editor-feature.port.ts';
import type { Tab } from '../../../types.ts';

export function stateWith(extensions: Extension, doc = '', selection?: { anchor: number; head?: number }): EditorState {
  return EditorState.create({ doc, extensions, selection });
}

export interface FakeView extends ViewLike { dispatched: TransactionSpec[]; focused: number }
export function fakeView(state: EditorState): FakeView {
  const fake = {
    state,
    dispatched: [] as TransactionSpec[],
    focused: 0,
    dispatch(...specs: TransactionSpec[]) {
      fake.dispatched.push(...specs);
      fake.state = fake.state.update(...specs).state;
    },
    focus() { fake.focused += 1; },
  };
  return fake as unknown as FakeView;
}

const TAB: Tab = { id: 't1', fileName: 'a.md', content: '', savedContent: '', encoding: 'utf-8', language: 'markdown', hadBom: false } as Tab;

export interface FakeContextInit extends Partial<Omit<EditorFeatureContext, 'settings' | 'props'>> {
  settings?: Record<string, unknown>;
  props?: Partial<EditorProps>;
  tabValue?: Partial<Tab>;
}
export function fakeContext(init: FakeContextInit = {}): EditorFeatureContext & { toasts: string[]; contents: Array<[string, string]> } {
  const toasts: string[] = [];
  const contents: Array<[string, string]> = [];
  const tab = { ...TAB, ...init.tabValue } as Tab;
  return {
    tab: () => tab,
    props: () => ({ focusMode: false, typewriterMode: false, spellCheck: true, ...init.props }),
    settings: (init.settings ?? {}) as unknown as EditorFeatureContext['settings'],
    themeMode: () => 'light',
    t: (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    setContent: (id, text) => { contents.push([id, text]); },
    findTab: (id) => (id === tab.id ? tab : undefined),
    activeTabId: () => tab.id,
    toast: { info: (m) => toasts.push(`info:${m}`), success: (m) => toasts.push(`success:${m}`), error: (m) => toasts.push(`error:${m}`) },
    view: () => null,
    run: (command) => { throw new Error(`fakeContext: no command ${command}`); },
    citations: () => [],
    ...rest,
    toasts,
    contents,
  } as EditorFeatureContext & { toasts: string[]; contents: Array<[string, string]> };
}
```

Spread `...init` after the defaults would also copy `settings`/`props`/`tabValue` raw — strip them first: `const { settings, props, tabValue, ...rest } = init;` and spread `rest`.

- [ ] **Step 3: Write the failing test** (`editor-feature.port.test.ts`)

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXTENSION_SLOTS, EditorFeatureManifestSchema } from './editor-feature.port.ts';

test('EXTENSION_SLOTS has 30 unique slots ending with update-listener', () => {
  assert.equal(EXTENSION_SLOTS.length, 30);
  assert.equal(new Set(EXTENSION_SLOTS).size, 30);
  assert.equal(EXTENSION_SLOTS.at(-1), 'update-listener');
});
test('manifest accepts kebab ids and rejects others', () => {
  assert.ok(EditorFeatureManifestSchema.safeParse({ id: 'image-upload', settingsKeys: [], i18nKeys: [] }).success);
  assert.ok(!EditorFeatureManifestSchema.safeParse({ id: 'ImageUpload', settingsKeys: [], i18nKeys: [] }).success);
});
```

- [ ] **Step 4:** `cd app && node --test src/features/editor/contracts/editor-feature.port.test.ts` → PASS (write test before Step 1 file exists to see FAIL first if you prefer TDD order).
- [ ] **Step 5:** `pnpm --dir app guard` → exit 0.

### Task 2: Registry service

**Files:**
- Create: `app/src/features/editor/internal/editor-feature-registry.service.ts`
- Test: `app/src/features/editor/internal/editor-feature-registry.service.test.ts`

**Interfaces — Produces:**

```ts
export interface RegisteredSlot { key: string; featureId: string; spec: ReconfigurableSlot }
export interface EditorFeatureRegistry {
  readonly features: readonly EditorFeature[];
  readonly slots: readonly RegisteredSlot[];          // key = `${featureId}:${spec.slot}`
  readonly watches: readonly FeatureWatch[];
  extensions(ctx: EditorFeatureContext, compartmentFor: CompartmentFor): Extension[];
  command(name: string): EditorCommand;               // throws Error(`[editor] unknown command: ${name}`)
  hasCommand(name: string): boolean;
}
export function createEditorFeatureRegistry(features: readonly EditorFeature[]): EditorFeatureRegistry;
```

Rules:
- Validate each feature with `EditorFeatureManifestSchema.parse({ id, settingsKeys: [...], i18nKeys: [...] })`.
- Throw `Error('[editor] duplicate feature id: <id>')`, `'[editor] duplicate command: <name>'`, `'[editor] <id> uses slot <slot> twice'` (a feature's reconfigurable slots must use distinct slot names).
- `extensions()`: collect entries `{ rank: EXTENSION_SLOTS.indexOf(slot), featureIndex, order, ext }` from static `extensions` (in `EXTENSION_SLOTS` order) and reconfigurable `slots` (skip when `when?.(ctx) === false`; else `compartmentFor(key).of(spec.build(ctx))`). Sort by `rank`, then `featureIndex`, then `order` (declaration order inside the feature). Return the flat list.

- [ ] **Step 1: Failing tests**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Compartment, type Extension } from '@codemirror/state';
import { createEditorFeatureRegistry } from './editor-feature-registry.service.ts';
import { fakeContext } from './cm-probe.ts';
import type { EditorFeature } from '../contracts/editor-feature.port.ts';

const tag = (name: string): Extension => ({ name } as unknown as Extension);
const comps = () => { const m = new Map<string, Compartment>(); return (k: string) => m.get(k) ?? (m.set(k, new Compartment()), m.get(k)!); };
const feature = (id: string, extra: Partial<EditorFeature> = {}): EditorFeature => ({ id, settingsKeys: [], i18nKeys: [], ...extra });

test('extensions sort by slot rank, ties by registration order', () => {
  const a = feature('a', { extensions: { keymap: () => tag('a-keymap'), history: () => tag('a-history') } });
  const b = feature('b', { extensions: { 'ime-guard': () => tag('b-ime'), keymap: () => tag('b-keymap') } });
  const names = createEditorFeatureRegistry([a, b]).extensions(fakeContext(), comps()).map((e) => (e as { name: string }).name);
  assert.deepEqual(names, ['b-ime', 'a-history', 'a-keymap', 'b-keymap']);
});
test('a slot whose when() is false contributes nothing', () => {
  const f = feature('f', { slots: [{ slot: 'vim', deps: () => 1, build: () => tag('vim'), when: () => false }] });
  assert.equal(createEditorFeatureRegistry([f]).extensions(fakeContext(), comps()).length, 0);
});
test('slot keys are featureId:slot', () => {
  const f = feature('vim', { slots: [{ slot: 'vim', deps: () => 1, build: () => [] }] });
  assert.deepEqual(createEditorFeatureRegistry([f]).slots.map((s) => s.key), ['vim:vim']);
});
test('duplicate id, duplicate command, bad id, repeated slot throw', () => {
  assert.throws(() => createEditorFeatureRegistry([feature('a'), feature('a')]), /duplicate feature id: a/);
  const cmd = { commands: { go: () => 1 } };
  assert.throws(() => createEditorFeatureRegistry([feature('a', cmd), feature('b', cmd)]), /duplicate command: go/);
  assert.throws(() => createEditorFeatureRegistry([feature('Bad')]));
  const twice = feature('t', { slots: [{ slot: 'fold', deps: () => 1, build: () => [] }, { slot: 'fold', deps: () => 2, build: () => [] }] });
  assert.throws(() => createEditorFeatureRegistry([twice]), /uses slot fold twice/);
});
test('command() returns the feature command and throws on unknown', () => {
  const r = createEditorFeatureRegistry([feature('a', { commands: { go: (_ctx: unknown, n: unknown) => Number(n) + 1 } })]);
  assert.equal(r.command('go')(fakeContext(), 1), 2);
  assert.throws(() => r.command('nope'), /unknown command: nope/);
});
```

- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3:** Implement per Rules above.
- [ ] **Step 4:** Run → PASS; `pnpm --dir app guard` → exit 0.

### Task 3: `useEditorFeatures` composable + shell registry + docs

**Files:**
- Create: `app/src/features/editor/internal/useEditorFeatures.ts`
- Test: `app/src/features/editor/internal/useEditorFeatures.test.ts`
- Create: `app/src/shell/editor-registry.service.ts`
- Create: `app/src/features/editor/CLAUDE.md`
- Modify: `app/CLAUDE.md` (map row `src/features/`; drop "Planned folders … `src/features/` (Wave 1+)"), `app/src/shell/CLAUDE.md` (one row for `editor-registry.service.ts`)

**Interfaces — Consumes:** Task 1–2. **Produces:**

```ts
export interface EditorFeaturesHost {
  extensions(): Extension[];                                  // registry.extensions(ctx, compartmentFor)
  run(name: string, ...args: unknown[]): unknown;             // registry.command(name)(ctx, ...args)
  mount(view: EditorView): void;                              // each feature.onMount
  beforeSwitchTab(view: EditorView, ids: TabSwitch): void;    // each feature.beforeTabSwitch
  switchTab(view: EditorView, ids: TabSwitch): void;          // each feature.onTabSwitch
  unmount(view: EditorView): void;                            // each feature.onUnmount
}
export function useEditorFeatures(registry: EditorFeatureRegistry, ctx: EditorFeatureContext): EditorFeaturesHost;

// shell/editor-registry.service.ts
/** Factories, so per-instance feature state (fold key, caret memory) is never shared between split panes.
 *  List order = lifecycle-hook order (setup, onMount, tab switch, unmount). Extension order comes from slots. */
export const EDITOR_FEATURE_FACTORIES: ReadonlyArray<() => EditorFeature> = [];   // PR-4..7 append
export function createEditorRegistry(): EditorFeatureRegistry {
  return createEditorFeatureRegistry(EDITOR_FEATURE_FACTORIES.map((create) => create()));
}
```

Behavior of `useEditorFeatures` (must be called inside a component setup or an `effectScope`):
- Compartments: one per slot key, created lazily, reused across `extensions()` calls (tab switch rebuilds state with the same compartments).
- Setup: call each `feature.setup?.(ctx)` once, in registration order; collect cleanups; `onScopeDispose(() => cleanups.forEach((c) => c()))`.
- Reconfigure: one `watch(() => registry.slots.map((s) => s.spec.deps(ctx)), (next, prev) => …)`. A slot changed when `!shallowEqual(next[i], prev[i])` (`Object.is`, or element-wise `Object.is` when both are arrays). Among changed slots, those with `when?.(ctx) !== false` are reconfigured in ONE `view.dispatch({ effects: [...] })` when `ctx.view()` is non-null. Then every changed slot's `after?.(ctx, ctx.view())` runs, in slot order, whether or not a view exists.
- Watches: one `watch(() => w.deps(ctx), () => w.run(ctx, ctx.view()))` per `FeatureWatch`, registration order.

- [ ] **Step 1: Failing tests** (use `effectScope` + `nextTick` from `vue`; a reactive settings object via `reactive({...})`)

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectScope, nextTick, reactive } from 'vue';
import { EditorState, type Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { createEditorFeatureRegistry } from './editor-feature-registry.service.ts';
import { useEditorFeatures } from './useEditorFeatures.ts';
import { fakeContext, fakeView } from './cm-probe.ts';

function harness() {
  const settings = reactive({ a: 1, b: 1 });
  const afters: string[] = [];
  const registry = createEditorFeatureRegistry([{
    id: 'x', settingsKeys: ['a', 'b'], i18nKeys: [],
    slots: [
      { slot: 'wrap', deps: () => settings.a, build: () => [] as Extension, after: () => afters.push('wrap') },
      { slot: 'font', deps: () => [settings.b, 'fixed'], build: () => [] as Extension, after: () => afters.push('font') },
    ],
  }]);
  let view: ReturnType<typeof fakeView> | null = null;
  const ctx = fakeContext({ settings, view: () => view as unknown as EditorView });
  const scope = effectScope();
  const host = scope.run(() => useEditorFeatures(registry, ctx))!;
  view = fakeView(EditorState.create({ extensions: host.extensions() }));
  return { settings, afters, scope, view: () => view! };
}

test('two slots changing in one tick → one dispatch, both afters', async () => {
  const h = harness();
  h.settings.a = 2; h.settings.b = 2;
  await nextTick();
  assert.equal(h.view().dispatched.length, 1);
  assert.deepEqual(h.afters, ['wrap', 'font']);
  h.scope.stop();
});
test('array deps that are element-wise equal do not reconfigure', async () => {
  const h = harness();
  h.settings.a = 1;  // unchanged
  await nextTick();
  assert.equal(h.view().dispatched.length, 0);
  h.scope.stop();
});
```

Add: `setup` cleanup runs on `scope.stop()`; a `FeatureWatch` runs once per change with `ctx.view()`; `after` runs with `null` when no view.

- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Docs.** `features/editor/CLAUDE.md` (≤ 60 lines): what the feature folder holds (host, engines, core features), how to add a feature (contract file, slot choice from `EXTENSION_SLOTS`, register in `shell/editor-registry.service.ts`, characterization tests with `cm-probe`), the no-`vue`-in-features rule, ADR 0004 link. `app/CLAUDE.md`: map row `src/features/` = "Editor features (Wave 2): `editor/` host + engines; one folder per feature. Read `features/editor/CLAUDE.md`"; "Which CLAUDE.md" row for `src/features/editor/`.
- [ ] **Step 6:** `pnpm --dir app guard` → exit 0. Controller: `pnpm --dir app verify`, `arch:rebaseline` (no change expected), commit.
