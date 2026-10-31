# Mind map: grow down, arrow branches, sort, auto-numbering, folded counts — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Grow down" layout, an "Arrow" branch style (parent → child with an arrowhead), "Sort children by name", auto-numbering of nodes, and an XMind-style count badge on folded nodes (setting + per-map toggle).

**Architecture:** mind-elixir 5.15.1 already ships a DOWN layout (`direction: 3`, `initDown()`, branch `direction === 'down'`), and the app already persists/validates `direction: 3` (`mindmap-format.ts`) and frames it (`mindmap-frame.ts`). So "grow down" is UI wiring plus making our custom straight/arrow branch generators DOWN-aware. Arrow style is a third `BranchStyle` whose SVG path is a straight segment plus an open arrowhead drawn in the same path (no `<marker>` defs → inherits branch color, works in export). Sort is a pure lib function that reorders `nodeObj.children` in place, run inside `runAsOneOperation` + `mind.refresh()` so it is one undo step. Auto-numbering reuses the same commit path and writes a `N. ` prefix into topics. The folded-count badge is a new `MapDisplay.foldedCount` flag, so it gets a global default in Settings and a per-map override in the side panel for free (both already render `MindmapMapFields`).

**Tech Stack:** Vue 3, mind-elixir 5.15.1, TypeScript, `node:test`.

**Spec:** This plan (user requests 2026-10-21: "support growth down in addition to grow left; add arrow branch style — branch is an arrow from parent to child; given a selected node, sort its children by name" + "auto numbering: one selected → number its direct children by current order; multiple selected → ask whether to number their children or themselves; toggle (and setting) to see the number of children on folded nodes, like XMind").

## Global Constraints

- Tests: `cd app && node --test --experimental-strip-types <file>`; typecheck: `pnpm --dir app build`.
- No comments in code, no magic numbers (named consts), functions ≤ 20 lines, no `any`.
- i18n: add new keys to `app/src/i18n/en.ts` only (other locales fall back to English, same as existing `layoutLeft`).
- Do not touch `mcp-mindmap/` (sort via MCP is out of scope).
- Another agent is working on `main` (mindmap workbench). Execute this plan only after that work lands, or in a worktree; expect touch points in `MindmapCanvas.vue`.

## Decisions (made, not open)

| # | Decision |
|---|---|
| D1 | Arrow style = straight segment + open arrowhead (2 wings, 9px, ±π/7) at the child anchor. Curved arrows: no. |
| D2 | Arrowhead lives in the branch path `d` (subpaths), not an SVG `<marker>` — color/width come from mind-elixir's `<path stroke=…>`. |
| D3 | DOWN anchors: parent bottom-center → child top-center, for both `straight` and `arrow`. `curve` keeps mind-elixir's own DOWN generator. |
| D4 | Sort key = `topic`, trimmed, `Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })` → Hebrew/Arabic/mixed and "Item 2 < Item 10" work. Stable. |
| D5 | Sort toggles: if children are already A→Z, sort Z→A; otherwise A→Z. Toast states the order applied. |
| D6 | Sort scope = direct children only (not recursive). < 2 children → no-op. |
| D7 | Sort entry points: node context menu + action id `mindmap.sortChildren`. No default shortcut. |
| D8 | Grow down entry point: 4th option in the rail "Layout direction" flyout. No new shortcut (mind-elixir binds `Mod+ArrowDown` to nothing; leave it). |
| D9 | Numbering writes into the topic text as `1. `, `2. ` … (survives export, MCP, outline). An existing `^\s*\d+[.)]\s+` prefix is replaced, so re-running renumbers instead of stacking. |
| D10 | One node selected → number its direct children. Several selected → dialog: "Their children" / "The selected nodes" / Cancel. |
| D11 | "The selected nodes" numbers each parent's selected nodes separately, in sibling order (two selections under A → 1, 2; one under B → 1). Root is skipped (no siblings). |
| D12 | Gate nodes are skipped by numbering (their topic is managed by gates). Sort still moves them. |
| D13 | "Remove numbering" action strips the prefix with the same scope rules. |
| D14 | Folded badge mode: `both` (default, `2 · 14` = direct children · all hidden descendants; one number when equal), `all`, `direct`, `off`. `999+` cap. Expanded nodes keep the normal ± control. |
| D15 | Folded badge is `MapDisplay.foldedCount: FoldedCountMode`. Global default = Settings → Mind map defaults; per-map override = side-panel Map fields select (same pattern as `branchStyle`). |

## File Map

| File | Change |
|---|---|
| `app/src/lib/mindmap-display.ts` | `BranchStyle` += `'arrow'`; DOWN-aware anchors; `arrowMainBranch` / `arrowSubBranch` |
| `app/src/lib/mindmap-display.test.ts` | tests for down + arrow |
| `app/src/composables/useMindmapDisplay.ts` | pick generator per style |
| `app/src/components/MindmapMapFields.vue` | `BRANCH_OPTIONS` += arrow |
| `app/src/lib/mindmap-icon-names.ts`, `app/src/components/MindmapIcon.vue`, `app/src/lib/mindmap-icon-names.test.ts` | `dir-down` icon |
| `app/src/components/MindmapRail.vue` | DOWN in `DIRECTIONS` |
| `app/src/components/MindmapCanvas.vue` | `mindmap.layoutDown`, `mindmap.sortChildren`, context-menu item |
| Create `app/src/lib/mindmap-sort.ts` + `.test.ts` | pure sort |
| Create `app/src/lib/mindmap-numbering.ts` + `.test.ts` | numbering planner + prefix rules |
| Create `app/src/components/MindmapNumberingDialog.vue` | scope choice for multi-select |
| Create `app/src/lib/mindmap-folded-count.ts` + `.test.ts` | direct/all counts, labels, DOM decorator |
| `app/src/components/MindmapCanvas.vue` (again) | numbering actions, badge decorator on `linkDiv`, badge CSS |
| `app/src/i18n/en.ts` | new strings |

---

### Task 1: DOWN-aware + arrow branch geometry (pure)

**Files:**
- Modify: `app/src/lib/mindmap-display.ts`
- Test: `app/src/lib/mindmap-display.test.ts`

**Interfaces:**
- Produces: `type BranchStyle = 'curve' | 'straight' | 'arrow'`; `straightMainBranch(p: BranchBox): string`; `straightSubBranch(p: BranchBox): string`; `arrowMainBranch(p: BranchBox): string`; `arrowSubBranch(p: BranchBox): string`.

- [ ] **Step 1: Write failing tests** (append to `mindmap-display.test.ts`; extend the import with `arrowMainBranch, arrowSubBranch`)

```ts
test('down layout branches run from parent bottom-center to child top-center', () => {
  const box = { pT: 0, pL: 0, pW: 100, pH: 40, cT: 100, cL: 200, cW: 80, cH: 30, direction: 'down' };
  assert.equal(straightMainBranch(box), 'M 50 40 L 240 100');
  assert.equal(straightSubBranch(box), 'M 50 40 L 240 100');
});

test('arrow branches are the straight segment plus a two-wing head at the child', () => {
  const box = { pT: 0, pL: 0, pW: 100, pH: 40, cT: 100, cL: 0, cW: 100, cH: 30, direction: 'down' };
  const path = arrowSubBranch(box);
  assert.ok(path.startsWith('M 50 40 L 50 100 M '), path);
  assert.match(path, / L 50 100 L /);
  const wings = [...path.matchAll(/M ([\d.-]+) ([\d.-]+) L 50 100 L ([\d.-]+) ([\d.-]+)$/g)][0];
  assert.ok(wings, path);
  assert.ok(Number(wings[2]) < 100 && Number(wings[4]) < 100, 'wings sit above the tip');
  assert.ok(Math.abs(Number(wings[1]) + Number(wings[3]) - 100) < 0.05, 'wings are symmetric around x=50');
});

test('arrow main branch on the left side points at the child right edge', () => {
  const box = { pT: 0, pL: 300, pW: 100, pH: 40, cT: 100, cL: 100, cW: 80, cH: 30, direction: 'lhs' };
  assert.ok(arrowMainBranch(box).startsWith('M 350 20 L 180 115 M '));
});

test('parseMapDisplay accepts the arrow branch style', () => {
  assert.deepEqual(parseMapDisplay({ branchStyle: 'arrow' }), { branchStyle: 'arrow' });
});
```

- [ ] **Step 2: Run — expect FAIL** (`arrowSubBranch` not exported; down path wrong)

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-display.test.ts`

- [ ] **Step 3: Implement.** Replace everything from `const LEFT_DIRECTION` usage down (keep parse/resolve/FONT_STACKS as is):

```ts
export type BranchStyle = 'curve' | 'straight' | 'arrow';
const BRANCH_STYLES: readonly BranchStyle[] = ['curve', 'straight', 'arrow'];
const LEFT_DIRECTION = 'lhs';
const DOWN_DIRECTION = 'down';
const HALF = 2;
const ARROW_HEAD_LENGTH = 9;
const ARROW_HEAD_SPREAD = Math.PI / 7;
const COORD_DECIMALS = 2;

interface Segment { x1: number; y1: number; x2: number; y2: number }

function round(value: number): number {
  return Number(value.toFixed(COORD_DECIMALS));
}

function line(s: Segment): string {
  return `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`;
}

function downSegment(p: BranchBox): Segment {
  return { x1: p.pL + p.pW / HALF, y1: p.pT + p.pH, x2: p.cL + p.cW / HALF, y2: p.cT };
}

function childAnchorX(p: BranchBox): number {
  return p.direction === LEFT_DIRECTION ? p.cL + p.cW : p.cL;
}

function mainSegment(p: BranchBox): Segment {
  if (p.direction === DOWN_DIRECTION) return downSegment(p);
  return { x1: p.pL + p.pW / HALF, y1: p.pT + p.pH / HALF, x2: childAnchorX(p), y2: p.cT + p.cH / HALF };
}

function subSegment(p: BranchBox): Segment {
  if (p.direction === DOWN_DIRECTION) return downSegment(p);
  const parentX = p.direction === LEFT_DIRECTION ? p.pL : p.pL + p.pW;
  return { x1: parentX, y1: p.pT + p.pH / HALF, x2: childAnchorX(p), y2: p.cT + p.cH / HALF };
}

function wing(s: Segment, angle: number): string {
  return `${round(s.x2 - ARROW_HEAD_LENGTH * Math.cos(angle))} ${round(s.y2 - ARROW_HEAD_LENGTH * Math.sin(angle))}`;
}

function arrow(s: Segment): string {
  const heading = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
  const tip = `${s.x2} ${s.y2}`;
  return `${line(s)} M ${wing(s, heading - ARROW_HEAD_SPREAD)} L ${tip} L ${wing(s, heading + ARROW_HEAD_SPREAD)}`;
}

export const straightMainBranch = (p: BranchBox): string => line(mainSegment(p));
export const straightSubBranch = (p: BranchBox): string => line(subSegment(p));
export const arrowMainBranch = (p: BranchBox): string => arrow(mainSegment(p));
export const arrowSubBranch = (p: BranchBox): string => arrow(subSegment(p));
```

Delete the old `line(x1,y1,x2,y2)`, `straightMainBranch`, `straightSubBranch` function declarations it replaces.

- [ ] **Step 4: Run — expect PASS** (all old tests too, incl. `'M 300 20 L 180 115'`)

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-display.test.ts`

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-display.ts app/src/lib/mindmap-display.test.ts
git commit -m "feat(mindmap): arrow branch geometry and down-layout anchors"
```

---

### Task 2: Wire the arrow style into the canvas + Map fields

**Files:**
- Modify: `app/src/composables/useMindmapDisplay.ts:16-20`
- Modify: `app/src/components/MindmapMapFields.vue:17-20`
- Modify: `app/src/i18n/en.ts` (next to `branchStraight`, ~line 1487)

**Interfaces:**
- Consumes: `arrowMainBranch`, `arrowSubBranch`, `straightMainBranch`, `straightSubBranch`, `BranchStyle` from Task 1.

- [ ] **Step 1: Replace `applyBranchStyle`** in `useMindmapDisplay.ts` (update import to include `arrowMainBranch, arrowSubBranch, type BranchStyle`):

```ts
type GeneratorPicker = (original: BranchGenerators) => BranchGenerators;

const GENERATORS_BY_STYLE: Readonly<Record<BranchStyle, GeneratorPicker>> = {
  curve: (original) => original,
  straight: () => ({ main: straightMainBranch, sub: straightSubBranch }),
  arrow: () => ({ main: arrowMainBranch, sub: arrowSubBranch }),
};

function applyBranchStyle(mind: MindElixirInstance, display: ResolvedMapDisplay, original: BranchGenerators): void {
  const picked = GENERATORS_BY_STYLE[display.branchStyle](original);
  mind.generateMainBranch = picked.main;
  mind.generateSubBranch = picked.sub;
}
```

If `vue-tsc` complains that `(p: BranchBox) => string` is not assignable to `generateMainBranch`, cast at the record: `{ main: arrowMainBranch as BranchGenerators['main'], ... }` — same as the current straight assignment compiles today, so it should not.

- [ ] **Step 2: Add the option** in `MindmapMapFields.vue`:

```ts
const BRANCH_OPTIONS: readonly { value: BranchStyle; labelKey: string }[] = [
  { value: 'curve', labelKey: 'mindmap.branchCurve' },
  { value: 'straight', labelKey: 'mindmap.branchStraight' },
  { value: 'arrow', labelKey: 'mindmap.branchArrow' },
];
```

- [ ] **Step 3: i18n** — in `en.ts` after `branchStraight: 'Straight',` add `branchArrow: 'Arrow',`

- [ ] **Step 4: Typecheck**

Run: `pnpm --dir app build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/src/composables/useMindmapDisplay.ts app/src/components/MindmapMapFields.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): arrow branch style option"
```

---

### Task 3: "Grow down" layout in the rail

**Files:**
- Modify: `app/src/lib/mindmap-icon-names.ts:3`
- Modify: `app/src/components/MindmapIcon.vue` (`PATHS`, after `dir-side`)
- Modify: `app/src/lib/mindmap-icon-names.test.ts:14`
- Modify: `app/src/components/MindmapRail.vue:29-33`
- Modify: `app/src/components/MindmapCanvas.vue:609-611`
- Modify: `app/src/i18n/en.ts:1373`

**Interfaces:**
- Consumes: `MINDMAP_LAYOUT.DOWN` (already `3` in `mindmap-direction.ts`); `mind.initDown()` (mind-elixir).
- Produces: action id `'mindmap.layoutDown'`; icon name `'dir-down'`.

- [ ] **Step 1: Failing test** — in `mindmap-icon-names.test.ts` add `'dir-down'` after `'dir-side'` in `names`.

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-icon-names.test.ts` → expect FAIL (or a type error at build) until the union is updated.

- [ ] **Step 2: Icon** — union: `| 'dir-left' | 'dir-right' | 'dir-side' | 'dir-down'`. In `MindmapIcon.vue` `PATHS`:

```ts
'dir-down': ['M12 3v5', 'M12 8c0 3-6 3-6 7v3', 'M12 8v10', 'M12 8c0 3 6 3 6 7v3'],
```

`CLASSIC_PATHS` / `CLASSIC_GLYPHS` are `Partial` — no classic glyph needed; classic style falls back to `PATHS`. Verify in the browser (Task 5); if classic shows nothing, add `'dir-down': '↓'` to `CLASSIC_GLYPHS`.

- [ ] **Step 3: Rail** — append to `DIRECTIONS`:

```ts
{ layout: MINDMAP_LAYOUT.DOWN, actionId: 'mindmap.layoutDown', icon: 'dir-down', labelKey: 'mindmap.layoutDown' },
```

`currentDirection` falls back to `DIRECTIONS[2]` (side) — unchanged, still correct.

- [ ] **Step 4: Action** — in `MindmapCanvas.vue` `actions`, after `'mindmap.layoutSide'`:

```ts
'mindmap.layoutDown': () => mind?.initDown(),
```

`initDown` fires `changeDirection` → `onDirectionChange` → `scheduleSync()` persists `direction: 3` (already accepted by `mindmap-format.ts`).

- [ ] **Step 5: i18n** — `en.ts` after `layoutSide: 'Both sides',` add `layoutDown: 'Grow down',`

- [ ] **Step 6: Test + typecheck**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-icon-names.test.ts src/lib/mindmap-direction.test.ts src/lib/mindmap-frame.test.ts && pnpm --dir app build`
Expected: PASS, build exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/src/lib/mindmap-icon-names.ts app/src/lib/mindmap-icon-names.test.ts app/src/components/MindmapIcon.vue app/src/components/MindmapRail.vue app/src/components/MindmapCanvas.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): grow-down layout in the direction flyout"
```

---

### Task 4: Sort children by name

**Files:**
- Create: `app/src/lib/mindmap-sort.ts`
- Test: `app/src/lib/mindmap-sort.test.ts`
- Modify: `app/src/components/MindmapCanvas.vue` (actions map ~line 598, context menu ~line 181)
- Modify: `app/src/i18n/en.ts` (mindmap block)

**Interfaces:**
- Produces: `type SortOrder = 'asc' | 'desc'`; `sortChildrenByTopic(node: NodeObj): SortOrder | null` (mutates `node.children` in place; `null` when < 2 children).
- Consumes: `runAsOneOperation(bus, work, event)` from `mindmap-batch.ts`.

- [ ] **Step 1: Failing tests** — `mindmap-sort.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { sortChildrenByTopic } from './mindmap-sort.ts';

const node = (topic: string, children: NodeObj[] = []): NodeObj => ({ id: topic, topic, children });
const topics = (n: NodeObj): string[] => (n.children ?? []).map((c) => c.topic);

test('sorts direct children A to Z with numeric awareness', () => {
  const root = node('r', [node('Item 10'), node('banana'), node('Item 2'), node('Apple')]);
  assert.equal(sortChildrenByTopic(root), 'asc');
  assert.deepEqual(topics(root), ['Apple', 'banana', 'Item 2', 'Item 10']);
});

test('sorting an already ascending list flips it to Z to A', () => {
  const root = node('r', [node('a'), node('b'), node('c')]);
  assert.equal(sortChildrenByTopic(root), 'desc');
  assert.deepEqual(topics(root), ['c', 'b', 'a']);
});

test('hebrew topics sort alphabetically', () => {
  const root = node('r', [node('גימל'), node('אלף'), node('בית')]);
  sortChildrenByTopic(root);
  assert.deepEqual(topics(root), ['אלף', 'בית', 'גימל']);
});

test('grandchildren keep their order', () => {
  const root = node('r', [node('b', [node('z'), node('y')]), node('a')]);
  sortChildrenByTopic(root);
  assert.deepEqual(topics(root.children![1]), ['z', 'y']);
});

test('fewer than two children is a no-op', () => {
  assert.equal(sortChildrenByTopic(node('r', [node('x')])), null);
  assert.equal(sortChildrenByTopic(node('r')), null);
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing)

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-sort.test.ts`

- [ ] **Step 3: Implement** `mindmap-sort.ts`:

```ts
import type { NodeObj } from 'mind-elixir';

export type SortOrder = 'asc' | 'desc';

const MIN_SORTABLE = 2;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareTopics(a: NodeObj, b: NodeObj): number {
  return collator.compare(a.topic.trim(), b.topic.trim());
}

function isAscending(children: readonly NodeObj[]): boolean {
  return children.every((child, i) => i === 0 || compareTopics(children[i - 1], child) <= 0);
}

export function sortChildrenByTopic(node: NodeObj): SortOrder | null {
  const children = node.children;
  if (!children || children.length < MIN_SORTABLE) return null;
  const order: SortOrder = isAscending(children) ? 'desc' : 'asc';
  children.sort(order === 'asc' ? compareTopics : (a, b) => compareTopics(b, a));
  return order;
}
```

- [ ] **Step 4: Run — expect PASS** (5/5)

- [ ] **Step 5: Canvas action** — in `MindmapCanvas.vue` (imports: `runAsOneOperation` from `../lib/mindmap-batch`, `sortChildrenByTopic, type SortOrder` from `../lib/mindmap-sort`):

```ts
const SORT_TOAST_KEYS: Readonly<Record<SortOrder, string>> = { asc: 'mindmap.sortedAsc', desc: 'mindmap.sortedDesc' };

const TREE_EDIT_OPERATION = 'moveNodeBefore';

function commitTreeEdit(instance: MindElixirInstance, anchor: NodeObj, mutate: () => NodeObj[]): boolean {
  const event: Record<string, unknown> = { name: TREE_EDIT_OPERATION, obj: anchor, objs: [] };
  runAsOneOperation(instance.bus as unknown as OperationBus, () => {
    const changed = mutate();
    event.objs = changed;
    if (changed.length > 0) instance.refresh();
    return changed.length > 0;
  }, event);
  const isChanged = (event.objs as NodeObj[]).length > 0;
  if (isChanged) instance.selectNode(instance.findEle(anchor.id));
  return isChanged;
}

function canEditTree(): boolean {
  return !!mind && !isEditBlocked() && !isGraphView.value;
}

function sortSelectedChildren(): void {
  const target = mind?.currentNode?.nodeObj;
  if (!mind || !target || !canEditTree()) return;
  const result: { order: SortOrder | null } = { order: null };
  commitTreeEdit(mind, target, () => {
    result.order = sortChildrenByTopic(target);
    return result.order ? target.children ?? [] : [];
  });
  toasts.info(t(result.order ? SORT_TOAST_KEYS[result.order] : 'mindmap.sortNothing'));
}
```

`commitTreeEdit` is reused by Task 5. `result`/`event` are objects (not `let`) because TS does not narrow a `let` assigned inside a closure. Why `moveNodeBefore`: mind-elixir's history (`Fn`) reads `objs` ids for that op name → one undo step that restores the pre-sort snapshot. `refresh()` without args re-renders from the mutated `nodeData`; it keeps `direction` (SIDE-mode root children keep their `direction` field, so they stay on their side and sort within it).

Register: `'mindmap.sortChildren': sortSelectedChildren,` in `actions`; context menu `extend` list: `{ name: t('mindmap.sortChildrenMenu'), onclick: sortSelectedChildren }`.

- [ ] **Step 6: i18n** — `en.ts` mindmap block:

```ts
sortChildrenMenu: 'Sort children by name',
sortedAsc: 'Children sorted A → Z',
sortedDesc: 'Children sorted Z → A',
sortNothing: 'Nothing to sort: select a node with 2+ children',
```

- [ ] **Step 7: Typecheck** — `pnpm --dir app build` → exit 0.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/mindmap-sort.ts app/src/lib/mindmap-sort.test.ts app/src/components/MindmapCanvas.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): sort selected node's children by name"
```

---

### Task 5: Auto-numbering

**Files:**
- Create: `app/src/lib/mindmap-numbering.ts`
- Test: `app/src/lib/mindmap-numbering.test.ts`
- Create: `app/src/components/MindmapNumberingDialog.vue`
- Modify: `app/src/components/MindmapCanvas.vue` (actions, context menu, dialog mount)
- Modify: `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: `commitTreeEdit(instance, anchor, mutate): boolean`, `canEditTree(): boolean` (Task 4); `isGate(node)` from `../lib/mindmap-gates` (already imported in the canvas).
- Produces: `type NumberingScope = 'children' | 'selves'`; `numberingGroups(selected: readonly NodeObj[], scope: NumberingScope): NodeObj[][]`; `applyNumbers(groups: readonly NodeObj[][], isNumbered: boolean, skip: (n: NodeObj) => boolean): NodeObj[]` (returns changed nodes); `stripNumber(topic: string): string`.

- [ ] **Step 1: Failing tests** — `mindmap-numbering.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { applyNumbers, numberingGroups, stripNumber } from './mindmap-numbering.ts';

function tree(topic: string, kids: string[] = []): NodeObj {
  const node: NodeObj = { id: topic, topic, children: [] };
  node.children = kids.map((k) => ({ id: k, topic: k, children: [], parent: node }));
  return node;
}
const never = (): boolean => false;
const topics = (nodes: readonly NodeObj[]): string[] => nodes.map((n) => n.topic);

test('stripNumber removes one leading "N." or "N)" prefix only', () => {
  assert.equal(stripNumber('3. Plan'), 'Plan');
  assert.equal(stripNumber('12) Plan'), 'Plan');
  assert.equal(stripNumber('2024 goals'), '2024 goals');
  assert.equal(stripNumber('1.5 release'), '1.5 release');
});

test('children scope numbers direct children in current order and renumbers old prefixes', () => {
  const root = tree('r', ['b', '7. a', 'c']);
  const changed = applyNumbers(numberingGroups([root], 'children'), true, never);
  assert.deepEqual(topics(root.children!), ['1. b', '2. a', '3. c']);
  assert.equal(changed.length, 3);
});

test('selves scope numbers selected siblings per parent in sibling order', () => {
  const a = tree('A', ['x', 'y', 'z']);
  const b = tree('B', ['q']);
  const [x, , z] = a.children!;
  applyNumbers(numberingGroups([z, b.children![0], x], 'selves'), true, never);
  assert.deepEqual(topics(a.children!), ['1. x', 'y', '2. z']);
  assert.equal(b.children![0].topic, '1. q');
});

test('selves scope skips the root', () => {
  assert.deepEqual(numberingGroups([tree('r', ['a'])], 'selves'), []);
});

test('remove numbering strips prefixes; skipped nodes are untouched and not counted', () => {
  const root = tree('r', ['1. a', 'gate', '3. b']);
  const isGateNode = (n: NodeObj): boolean => n.topic === 'gate';
  applyNumbers(numberingGroups([root], 'children'), true, isGateNode);
  assert.deepEqual(topics(root.children!), ['1. a', 'gate', '2. b']);
  applyNumbers(numberingGroups([root], 'children'), false, isGateNode);
  assert.deepEqual(topics(root.children!), ['a', 'gate', 'b']);
});

test('unchanged topics are not reported as changed', () => {
  const root = tree('r', ['1. a', '2. b']);
  assert.equal(applyNumbers(numberingGroups([root], 'children'), true, never).length, 0);
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing)

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-numbering.test.ts`

- [ ] **Step 3: Implement** `mindmap-numbering.ts`:

```ts
import type { NodeObj } from 'mind-elixir';

export type NumberingScope = 'children' | 'selves';

const NUMBER_PREFIX = /^\s*\d+[.)]\s+/;
const FIRST_NUMBER = 1;

export function stripNumber(topic: string): string {
  return topic.replace(NUMBER_PREFIX, '');
}

function siblingOrder(node: NodeObj): number {
  return node.parent?.children?.indexOf(node) ?? -1;
}

function groupSelvesByParent(selected: readonly NodeObj[]): NodeObj[][] {
  const groups = new Map<string, NodeObj[]>();
  for (const node of selected) {
    if (!node.parent) continue;
    groups.set(node.parent.id, [...(groups.get(node.parent.id) ?? []), node]);
  }
  return [...groups.values()].map((group) => group.sort((a, b) => siblingOrder(a) - siblingOrder(b)));
}

export function numberingGroups(selected: readonly NodeObj[], scope: NumberingScope): NodeObj[][] {
  if (scope === 'selves') return groupSelvesByParent(selected);
  return selected.map((node) => node.children ?? []).filter((kids) => kids.length > 0);
}

function retitle(node: NodeObj, topic: string, changed: NodeObj[]): void {
  if (node.topic === topic) return;
  node.topic = topic;
  changed.push(node);
}

export function applyNumbers(groups: readonly NodeObj[][], isNumbered: boolean, skip: (n: NodeObj) => boolean): NodeObj[] {
  const changed: NodeObj[] = [];
  for (const group of groups) {
    let next = FIRST_NUMBER;
    for (const node of group.filter((n) => !skip(n))) {
      const bare = stripNumber(node.topic);
      retitle(node, isNumbered ? `${next++}. ${bare}` : bare, changed);
    }
  }
  return changed;
}
```

`node.parent` is set by mind-elixir at runtime on every non-root `NodeObj`; the tests set it by hand.

- [ ] **Step 4: Run — expect PASS** (6/6)

- [ ] **Step 5: Dialog** — `MindmapNumberingDialog.vue`:

```vue
<script setup lang="ts">
import { DsButton, DsModal } from '../ui';
import { useI18n } from '../i18n';
import type { NumberingScope } from '../lib/mindmap-numbering';

defineProps<{ open: boolean; count: number }>();
const emit = defineEmits<{ choose: [scope: NumberingScope]; cancel: [] }>();
const { t } = useI18n();
</script>

<template>
  <DsModal :model-value="open" :title="t('mindmap.numberingTitle', { count })" width="360px" @update:model-value="(isOpen) => !isOpen && emit('cancel')">
    <div class="mm-numbering">
      <DsButton @click="emit('choose', 'children')">{{ t('mindmap.numberingChildren') }}</DsButton>
      <DsButton @click="emit('choose', 'selves')">{{ t('mindmap.numberingSelves') }}</DsButton>
      <DsButton variant="ghost" @click="emit('cancel')">{{ t('mindmap.numberingCancel') }}</DsButton>
    </div>
  </DsModal>
</template>

<style scoped>
.mm-numbering { display: flex; flex-direction: column; gap: 8px; }
</style>
```

Before writing: check `DsButton` props (`grep -n defineProps app/src/ui/DsButton.vue`) and how `t()` interpolates params (`grep -n "{count}" app/src/i18n/en.ts | head -3`). Match what exists.

- [ ] **Step 6: Canvas wiring** — in `MindmapCanvas.vue` (imports: `applyNumbers, numberingGroups, type NumberingScope` from `../lib/mindmap-numbering`; `MindmapNumberingDialog`):

```ts
const pendingNumbering = ref<{ isNumbered: boolean; count: number } | null>(null);

function selectedNodes(): NodeObj[] {
  return (mind?.currentNodes ?? []).map((tpc) => tpc.nodeObj);
}

function reselect(instance: MindElixirInstance, nodes: readonly NodeObj[]): void {
  if (nodes.length > 1) instance.selectNodes(nodes.map((n) => instance.findEle(n.id)));
}

function runNumbering(scope: NumberingScope, isNumbered: boolean): void {
  const selected = selectedNodes();
  if (!mind || selected.length === 0 || !canEditTree()) return;
  const isChanged = commitTreeEdit(mind, selected[0], () => applyNumbers(numberingGroups(selected, scope), isNumbered, isGate));
  if (!isChanged) toasts.info(t('mindmap.numberingNothing'));
  reselect(mind, selected);
}

function requestNumbering(isNumbered: boolean): void {
  const count = selectedNodes().length;
  if (count === 0 || !canEditTree()) return;
  if (count === 1) {
    runNumbering('children', isNumbered);
    return;
  }
  pendingNumbering.value = { isNumbered, count };
}

function onNumberingChoice(scope: NumberingScope): void {
  const pending = pendingNumbering.value;
  pendingNumbering.value = null;
  if (pending) runNumbering(scope, pending.isNumbered);
}
```

Register actions: `'mindmap.numberChildren': () => requestNumbering(true)`, `'mindmap.removeNumbers': () => requestNumbering(false)`. Context menu `extend`: `{ name: t('mindmap.numberMenu'), onclick: () => requestNumbering(true) }`, `{ name: t('mindmap.removeNumbersMenu'), onclick: () => requestNumbering(false) }`. Template, next to the shortcut-help mount:

```vue
<MindmapNumberingDialog :open="pendingNumbering !== null" :count="pendingNumbering?.count ?? 0" @choose="onNumberingChoice" @cancel="pendingNumbering = null" />
```

Selection survives because the dialog does not touch `mind.currentNodes`. Risk: mind-elixir's keydown handler is on `mind.container`; the modal is teleported to `<body>`, so Enter/Esc in the dialog should not reach it. Verify in Task 7.

- [ ] **Step 7: i18n** — `en.ts` mindmap block:

```ts
numberMenu: 'Number children',
removeNumbersMenu: 'Remove numbering',
numberingTitle: 'Number {count} selected nodes',
numberingChildren: 'Their children',
numberingSelves: 'The selected nodes',
numberingCancel: 'Cancel',
numberingNothing: 'Nothing to number',
```

- [ ] **Step 8: Typecheck** — `pnpm --dir app build` → exit 0.

- [ ] **Step 9: Commit**

```bash
git add app/src/lib/mindmap-numbering.ts app/src/lib/mindmap-numbering.test.ts app/src/components/MindmapNumberingDialog.vue app/src/components/MindmapCanvas.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): auto-number children or selected nodes"
```

---

### Task 6: Child-count badge on folded nodes (setting + per-map choice)

**Files:**
- Create: `app/src/lib/mindmap-folded-count.ts`
- Test: `app/src/lib/mindmap-folded-count.test.ts`
- Modify: `app/src/lib/mindmap-display.ts` (+ `mindmap-display.test.ts`)
- Modify: `app/src/composables/useMindmapDisplay.ts`
- Modify: `app/src/components/MindmapMapFields.vue`
- Modify: `app/src/components/MindmapCanvas.vue` (`linkDiv` listener, CSS)
- Modify: `app/src/i18n/en.ts`

**Interfaces:**
- Produces: `type FoldedCountMode = 'off' | 'direct' | 'all' | 'both'`; `MapDisplay.foldedCount?: FoldedCountMode`, `ResolvedMapDisplay.foldedCount: FoldedCountMode` (default `'both'`); `foldedCountLabels(node: NodeObj): FoldedLabels | null`; `decorateFoldedCounts(root: ParentNode): void`; CSS class `mm-folded-count--<mode>` on `mind.container`.

- [ ] **Step 1: Failing tests** — `mindmap-folded-count.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeObj } from 'mind-elixir';
import { foldedCountLabels } from './mindmap-folded-count.ts';

const leaf = (id: string): NodeObj => ({ id, topic: id });
const folded = (children: NodeObj[]): NodeObj => ({ id: 'p', topic: 'p', expanded: false, children });

test('a folded node gets direct, all-descendant and combined labels', () => {
  const node = folded([{ id: 'a', topic: 'a', children: [leaf('a1'), leaf('a2')] }, leaf('b')]);
  assert.deepEqual(foldedCountLabels(node), { direct: '2', all: '4', both: '2 · 4' });
});

test('combined label collapses to one number when nothing is nested', () => {
  assert.deepEqual(foldedCountLabels(folded([leaf('a'), leaf('b')])), { direct: '2', all: '2', both: '2' });
});

test('expanded or childless nodes have no labels', () => {
  assert.equal(foldedCountLabels({ id: 'p', topic: 'p', expanded: true, children: [leaf('a')] }), null);
  assert.equal(foldedCountLabels({ id: 'p', topic: 'p', children: [leaf('a')] }), null);
  assert.equal(foldedCountLabels(folded([])), null);
});

test('huge counts are capped', () => {
  const labels = foldedCountLabels(folded(Array.from({ length: 1200 }, (_, i) => leaf(String(i)))));
  assert.deepEqual(labels, { direct: '999+', all: '999+', both: '999+' });
});
```

Append to `mindmap-display.test.ts`:

```ts
test('foldedCount accepts known modes and defaults to both', () => {
  assert.deepEqual(parseMapDisplay({ foldedCount: 'direct' }), { foldedCount: 'direct' });
  assert.deepEqual(parseMapDisplay({ foldedCount: true }), {});
  assert.equal(resolveMapDisplay({}, {}).foldedCount, 'both');
  assert.equal(resolveMapDisplay({}, { foldedCount: 'off' }).foldedCount, 'off');
  assert.equal(resolveMapDisplay({ foldedCount: 'all' }, { foldedCount: 'off' }).foldedCount, 'all');
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-folded-count.test.ts src/lib/mindmap-display.test.ts`

- [ ] **Step 3: Implement** `mindmap-folded-count.ts`:

```ts
import type { NodeObj } from 'mind-elixir';

export interface FoldedLabels { direct: string; all: string; both: string }

const MAX_SHOWN = 999;
const BOTH_SEPARATOR = ' · ';
const LABEL_ATTRS: Readonly<Record<keyof FoldedLabels, string>> = { direct: 'data-count-direct', all: 'data-count-all', both: 'data-count-both' };
const EXPANDER_SELECTOR = 'me-epd';
const TOPIC_SELECTOR = ':scope > me-tpc';

function descendantCount(node: NodeObj): number {
  return (node.children ?? []).reduce((sum, child) => sum + 1 + descendantCount(child), 0);
}

function capped(count: number): string {
  return count > MAX_SHOWN ? `${MAX_SHOWN}+` : String(count);
}

export function foldedCountLabels(node: NodeObj): FoldedLabels | null {
  if (node.expanded !== false || !node.children?.length) return null;
  const direct = capped(node.children.length);
  const all = capped(descendantCount(node));
  return { direct, all, both: direct === all ? direct : direct + BOTH_SEPARATOR + all };
}

type TopicElement = HTMLElement & { nodeObj?: NodeObj };

function writeLabels(expander: HTMLElement, labels: FoldedLabels | null): void {
  for (const key of Object.keys(LABEL_ATTRS) as (keyof FoldedLabels)[]) {
    if (labels) expander.setAttribute(LABEL_ATTRS[key], labels[key]);
    else expander.removeAttribute(LABEL_ATTRS[key]);
  }
}

export function decorateFoldedCounts(root: ParentNode): void {
  for (const expander of root.querySelectorAll<HTMLElement>(EXPANDER_SELECTOR)) {
    const topic = expander.parentElement?.querySelector<TopicElement>(TOPIC_SELECTOR);
    writeLabels(expander, topic?.nodeObj ? foldedCountLabels(topic.nodeObj) : null);
  }
}
```

`mindmap-display.ts`:

```ts
export type FoldedCountMode = 'off' | 'direct' | 'all' | 'both';
const FOLDED_COUNT_MODES: readonly FoldedCountMode[] = ['off', 'direct', 'all', 'both'];
```

Add `foldedCount?: FoldedCountMode` to `MapDisplay`; `foldedCount: FoldedCountMode` to `ResolvedMapDisplay`; `foldedCount: 'both'` to `DEFAULT_MAP_DISPLAY`; in `parseMapDisplay`: `if (FOLDED_COUNT_MODES.includes(value.foldedCount as FoldedCountMode)) out.foldedCount = value.foldedCount as FoldedCountMode;`; in `resolveMapDisplay`: `foldedCount: override.foldedCount ?? defaults.foldedCount ?? DEFAULT_MAP_DISPLAY.foldedCount,`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Apply the mode class** — `useMindmapDisplay.ts`:

```ts
const FOLDED_COUNT_CLASS_PREFIX = 'mm-folded-count--';

function applyFoldedCount(mind: MindElixirInstance, mode: FoldedCountMode): void {
  const classes = mind.container.classList;
  for (const name of [...classes]) if (name.startsWith(FOLDED_COUNT_CLASS_PREFIX)) classes.remove(name);
  classes.add(FOLDED_COUNT_CLASS_PREFIX + mode);
}
```

Call `applyFoldedCount(mind, display.foldedCount);` in `applyMapDisplay` before `mind.linkDiv()`.

- [ ] **Step 6: Decorate after every layout** — `MindmapCanvas.vue`, with the other `mind.bus.addListener` calls (~line 199):

```ts
const LINK_DIV_EVENT = 'linkDiv';
mind.bus.addListener(LINK_DIV_EVENT, () => { if (mind) decorateFoldedCounts(mind.nodes); });
```

mind-elixir fires `linkDiv` after expand/collapse, refresh, undo/redo and layout changes. All three labels are always written (cheap attribute writes); the mode picks one in CSS, so switching mode needs no re-render.

- [ ] **Step 7: CSS** — `MindmapCanvas.vue` `<style scoped>`:

```css
.mindmap-view__canvas :deep(:is(.mm-folded-count--direct, .mm-folded-count--all, .mm-folded-count--both) me-epd[data-count-all]:not(.minus)) {
  background-image: none;
  background-color: var(--main-color);
  color: var(--main-bgcolor);
  width: auto;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 11px;
  line-height: 18px;
  text-align: center;
  white-space: nowrap;
  opacity: 1;
}
.mindmap-view__canvas :deep(.mm-folded-count--direct me-epd[data-count-direct]:not(.minus)::after) { content: attr(data-count-direct); }
.mindmap-view__canvas :deep(.mm-folded-count--all me-epd[data-count-all]:not(.minus)::after) { content: attr(data-count-all); }
.mindmap-view__canvas :deep(.mm-folded-count--both me-epd[data-count-both]:not(.minus)::after) { content: attr(data-count-both); }
```

`off` matches none of these, so the stock "+" stays.

- [ ] **Step 8: Mode picker** — `MindmapMapFields.vue` (import `FoldedCountMode`), next to Branch style:

```ts
const FOLDED_COUNT_OPTIONS: readonly { value: FoldedCountMode; labelKey: string }[] = [
  { value: 'both', labelKey: 'mindmap.foldedCountBoth' },
  { value: 'all', labelKey: 'mindmap.foldedCountAll' },
  { value: 'direct', labelKey: 'mindmap.foldedCountDirect' },
  { value: 'off', labelKey: 'mindmap.foldedCountOff' },
];
```

```vue
<label>{{ t('mindmap.fieldFoldedCount') }}
  <select :value="value.foldedCount ?? inherited?.foldedCount ?? 'both'" @change="emit('set', { foldedCount: ($event.target as HTMLSelectElement).value as FoldedCountMode })">
    <option v-for="o in FOLDED_COUNT_OPTIONS" :key="o.value" :value="o.value">{{ t(o.labelKey) }}</option>
  </select>
  <button v-if="isSet('foldedCount')" type="button" @click="emit('clear', 'foldedCount')">{{ resetLabel() }}</button>
</label>
```

This one component is both the per-map choice (side panel, `MindmapView.vue:444`) and the global setting (Settings → mind map defaults, `SettingsPanel.vue:1256`).

`en.ts` mindmap block, next to `fieldCompact`:

```ts
fieldFoldedCount: 'Count on folded nodes',
foldedCountBoth: 'Direct · all (2 · 14)',
foldedCountAll: 'All hidden nodes',
foldedCountDirect: 'Direct children',
foldedCountOff: 'Off',
```

- [ ] **Step 9: Typecheck** — `pnpm --dir app build` → exit 0.

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/mindmap-folded-count.ts app/src/lib/mindmap-folded-count.test.ts app/src/lib/mindmap-display.ts app/src/lib/mindmap-display.test.ts app/src/composables/useMindmapDisplay.ts app/src/components/MindmapMapFields.vue app/src/components/MindmapCanvas.vue app/src/i18n/en.ts
git commit -m "feat(mindmap): direct/all child-count badge on folded nodes"
```

---

### Task 7: Browser verification

**Files:** none (no commit unless a fix is needed).

- [ ] **Step 1:** `preview_start {name: "solomd-web"}` (port 1420), open/create a `.mmap` with ≥ 4 root children and a node with mixed-case + numbered + Hebrew children.
- [ ] **Step 2: Grow down** — rail → Layout direction → "Grow down". Expect: tree top-to-bottom, flyout icon = `dir-down`, reload keeps it (file has `"direction": 3`). Check both control styles (classic/compact).
- [ ] **Step 3: Arrow** — Map fields → Branch style → Arrow, in Side, Left and Down layouts. Expect arrowheads touching the child edge (right edge on left side, left edge on right side, top in down), branch color matches. Export PNG + SVG show arrows.
- [ ] **Step 4: Sort** — right-click a node → "Sort children by name": A→Z toast; again → Z→A; `⌘Z` restores original order in one step; `⌘⇧Z` re-applies. Root in Side layout: children stay on their sides.
- [ ] **Step 5: Numbering** — one node selected → "Number children" → `1. … n.`; run again → "Nothing to number" toast; reorder with Alt+↑ then renumber → follows new order. Select 3 nodes under 2 parents → dialog → "The selected nodes" → per-parent 1..k; "Their children" → each child list numbered. Enter/Esc inside the dialog must not add/remove map nodes. "Remove numbering" strips. ⌘Z = one step each. Hebrew topics show `1. אלף` correctly.
- [ ] **Step 6: Folded badge** — fold a node with 2 children + 2 grandchildren → `2 · 4` (both), `4` (all), `2` (direct), `+` (off); expand → normal ±. Side-panel choice applies to this map only; Settings default applies to maps without an override. Check lhs, rhs and down badge positions.
- [ ] **Step 7:** `read_console_messages {onlyErrors: true}` → empty. Screenshot down+arrow and a folded badge as proof.
- [ ] **Step 8:** Full suite: `cd app && node --test --experimental-strip-types src/lib/*.test.ts` → all pass.

## Out of scope (follow-ups)

- `mmap_sort` MCP tool in `mcp-mindmap/`.
- Recursive sort / sort by other fields (tags, gate state).
- Default keyboard shortcuts for grow-down, sort and numbering.
- Numbering styles other than `1.` (a., i., nested 1.1 outline numbers).
- Folded badge in the read-only fence renderer and in PNG/SVG export.
