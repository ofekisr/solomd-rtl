# Mindmap Phase 2 — `.xmind` Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Existing `.xmind` files open in SoloMD as editable mindmaps; saving writes a sibling `.mmap` and never touches the `.xmind`.

**Architecture:** `.xmind` bytes are read with the Rust `read_binary_file` command and converted by `@mind-elixir/import-xmind` into the Phase 1 `.mmap` envelope, after passing the Phase 1 sanitizers. The result opens as a **path-less** mindmap tab named `<name>.mmap`, which carries `importedFrom` (the source path). Because the tab has no `filePath`, every save goes through Save As, pre-filled with the sibling `.mmap` path. A guard refuses any Save As target that ends in `.xmind`.

**Tech Stack:** Vue 3.5 + Pinia, TypeScript 5.6, Tauri 2 (Rust), `mind-elixir@5.15.1`, `@mind-elixir/import-xmind@1.0.8`, `jszip@3.10.1` (dev, test fixtures), `node:test`.

**Spec:** `docs/design/mindmap/2026-10-11-mindmap-design.md` (Phase 2 section, Guiding rule).

## Status

**Complete — 11-10-26.** Branch `feat/mindmap` (not merged), released as `4.14.10`. All 5 tasks reviewed clean; final review fixes re-reviewed clean.

| Task | Commits | Notes |
|---|---|---|
| 1 Sanitizer | `437b2ee` | `icons`/`tags`/`image` validated |
| 2 Converter | `b22443f` | `xmind-import.ts`, Zen + legacy XML |
| 3 Open / Save As | `5574c2b` | Path-less tab + `importedFrom`; sibling `.mmap`; lazy chunk |
| 4 Native | `e10fa11` | Rust `detect_language`, CLI filter, association (Viewer) |
| 5 Verification | (this docs commit) | Browser-verified: RTL render, tags, folded state, notes kept |
| Final review | `fe0cb91`, `f6894a6` | Double-click race; `node.style` allowlist + CSS-escape rejection; size caps; shared `.xmind` write guard; friendly errors; `.xmind` association: macOS rank Alternate, none on Windows |

Deviations: constants/errors in `xmind-limits.ts`; Mind Elixir shows no note indicator (note data kept); `File` built from `bytes.slice().buffer` for TS ≥ 5.7.

Known open items:
- Native Tauri check for Phase 1 + 2 still owed: open each `/Users/ofeki/works/tools-ledger/*.xmind` via Finder, save, confirm the `.xmind` is unchanged and a sibling `.mmap` is created.
- Size cap is applied after `read_binary_file` loads the bytes; the zip header's declared size can be understated. A Rust size-checked read would close this.
- Deferred minors: node id/arrow/summary geometry validation (shared with Phase 1), import-xmind `console.log` + inlined deps, no reveal-in-tree on import, large imported maps persisted to localStorage, i18n of toasts.

## Spike findings (11-10-26, throwaway code, not committed)

| Question | Result |
|---|---|
| Import, XMind desktop Zen JSON (user files v1.0/v1.1) | ✅ 189 / 256 nodes, titles + folded state |
| Import, `md_to_xmind.py` output (v1.2/v1.3) | ✅ 375 / 375 nodes |
| Import, synthetic Zen file | ✅ Hebrew, notes, labels→`tags`, `href`→`hyperLink`, summaries, relationships→`arrows` |
| Import, synthetic legacy XML (XMind 8) | ✅ titles, notes, labels, folded |
| Import drops | Sheets 2+ (one sheet per call), markers, floating (detached) topics, legacy `xlink:href`, `xap:` image paths (render broken) |
| `javascript:` links | Pass through import → removed by the existing `SAFE_LINK_PATTERN` |
| `@mind-elixir/export-xmind@2.0.1` | ❌ **Rejected.** Peer range core 2–3 (needs `--legacy-peer-deps`); ~40-line converter writes titles + 4 style fields into a hardcoded theme; round-trip loses folded state, notes, tags, links, arrows, summaries, and the source theme and sheets; mutates its input |

## Approved decisions

- Import the **first sheet**. If there are more sheets, show a warning toast naming the count.
- Saving an imported tab → Save As, pre-filled with `<same folder>/<same name>.mmap`. The `.xmind` is never written.
- `image.url` is kept only for `http(s)` URLs with positive width and height.
- `icons` keep string entries only. `tags` keep strings and `{ text }` objects (normalized to `{ text }`).
- Markers are not mapped to icons.

## Global Constraints

- Package manager: `pnpm` inside `app/`. Commit `app/pnpm-lock.yaml` with dependency changes. Pin exact versions (no caret).
- Every piece of data handed to Mind Elixir goes through `sanitizeMindmapData` / `sanitizeNodeObj` (`app/src/lib/mindmap-format.ts`).
- No new validation library (no `zod`); hand-written type guards. No `any`. Constants for every magic value. Functions ≤ ~20 lines.
- Tests: `cd app && node --test --experimental-strip-types src/lib/<file>.test.ts`. Runtime imports between `src/lib` modules use the explicit `.ts` extension. Imports from `src/composables` / `src/components` into `src/lib` stay extensionless (Vite).
- Type check + build: `cd app && pnpm build`. Rust: `cd app/src-tauri && cargo test --test read_file_test`.
- Out of scope, pre-existing: 12 failing `src/lib/*.test.ts` (extensionless imports); the `.rs` assertion in Rust `detect_language_from_extension`.
- Commit trailer: `Co-Authored-By: Claude <model> 5.5 <noreply@anthropic.com>` (use the implementing model's name).

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `app/src/lib/mindmap-format.ts` | Modify | Sanitize `icons` / `tags` / `image`; `XMIND_EXTENSION`; `isXmindPath`, `mmapPathFor` |
| `app/src/lib/mindmap-format.test.ts` | Modify | Tests for the above |
| `app/src/lib/xmind-import.ts` | Create | `convertXmind(bytes, fileName)` → `.mmap` text, or an error |
| `app/src/lib/xmind-import.test.ts` | Create | Zen / legacy / malformed fixtures built in-test with `jszip` |
| `app/src/types.ts` | Modify | `Tab.importedFrom?: string` |
| `app/src/stores/tabs.ts` | Modify | `newTab` accepts `importedFrom` |
| `app/src/composables/useFiles.ts` | Modify | `openXmind`; route in `openPath`; Save As default + `.xmind` guard; link set |
| `app/src/components/FileTree.vue` | Modify | `xmind` icon |
| `app/src/lib/file-language.test.ts` | Modify | `.xmind` → `mindmap` |
| `app/src-tauri/src/commands.rs`, `src-tauri/src/main.rs`, `src-tauri/tauri.conf.json`, `src-tauri/tests/read_file_test.rs` | Modify | Native routing + file association |

---

### Task 1: Sanitizer hardening (`icons`, `tags`, `image`)

**Files:**
- Modify: `app/src/lib/mindmap-format.ts` (constants block lines 1–13; `sanitizeNode` lines 75–81)
- Test: `app/src/lib/mindmap-format.test.ts`

**Interfaces:**
- Consumes: existing `isRecord`, `SAFE_LINK_PATTERN`, `sanitizeNodeObj(value: unknown): NodeObj | null`.
- Produces: no new exports. `sanitizeNode` (and therefore `sanitizeNodeObj`, `sanitizeMindmapData`, `parseMindmap`) now normalizes `icons`, `tags`, `image`.

- [x] **Step 1: Write the failing tests** — append to `app/src/lib/mindmap-format.test.ts`:

```ts
test('icons keep only string entries', () => {
  const node = sanitizeNodeObj({ id: 'a', topic: 't', icons: ['⭐', 5, { x: 1 }, '✅'] });
  assert.deepEqual(node?.icons, ['⭐', '✅']);
});

test('non-array icons and tags are removed', () => {
  const node = sanitizeNodeObj({ id: 'a', topic: 't', icons: 'nope', tags: { text: 'x' } });
  assert.equal(node?.icons, undefined);
  assert.equal(node?.tags, undefined);
});

test('tags keep strings and text objects, dropping style and className', () => {
  const node = sanitizeNodeObj({
    id: 'a',
    topic: 't',
    tags: ['תווית', { text: 'ok', className: 'evil', style: { background: 'url(x)' } }, { text: 3 }, null],
  });
  assert.deepEqual(node?.tags, ['תווית', { text: 'ok' }]);
});

test('image is kept only for http(s) urls with positive size', () => {
  const ok = { url: 'https://example.com/a.png', width: 10, height: 20 };
  assert.deepEqual(sanitizeNodeObj({ id: 'a', topic: 't', image: ok })?.image, ok);
  for (const image of [
    { url: 'xap:resources/a.png', width: 10, height: 10 },
    { url: 'javascript:alert(1)', width: 10, height: 10 },
    { url: 'https://example.com/a.png', width: 0, height: 10 },
    { url: 'https://example.com/a.png' },
    'https://example.com/a.png',
  ]) {
    assert.equal(sanitizeNodeObj({ id: 'a', topic: 't', image })?.image, undefined);
  }
});

test('nested children are sanitized too', () => {
  const node = sanitizeNodeObj({ id: 'r', topic: 'r', children: [{ id: 'c', topic: 'c', icons: [1] }] });
  assert.deepEqual(node?.children?.[0].icons, []);
});
```

- [x] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-format.test.ts`
Expected: the 5 new tests FAIL (values pass through unchanged); existing tests PASS.

- [x] **Step 3: Implement** — in `app/src/lib/mindmap-format.ts`, add after `SAFE_LINK_PATTERN`:

```ts
const SAFE_IMAGE_URL_PATTERN = /^https?:/i;
```

Add above `sanitizeNode` (after `isNodeObj`):

```ts
type TagEntry = NonNullable<NodeObj['tags']>[number];

function sanitizeTag(tag: unknown): TagEntry | null {
  if (typeof tag === 'string') return tag;
  if (isRecord(tag) && typeof tag.text === 'string') return { text: tag.text };
  return null;
}

function sanitizeTags(tags: unknown): TagEntry[] | undefined {
  if (!Array.isArray(tags)) return undefined;
  return tags.map(sanitizeTag).filter((tag): tag is TagEntry => tag !== null);
}

function sanitizeIcons(icons: unknown): string[] | undefined {
  if (!Array.isArray(icons)) return undefined;
  return icons.filter((icon): icon is string => typeof icon === 'string');
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isSafeImage(image: unknown): boolean {
  if (!isRecord(image) || typeof image.url !== 'string') return false;
  return SAFE_IMAGE_URL_PATTERN.test(image.url) && isPositiveNumber(image.width) && isPositiveNumber(image.height);
}
```

Replace `sanitizeNode` with:

```ts
function sanitizeNode(node: NodeObj): NodeObj {
  const copy: NodeObj = { ...node };
  delete copy.dangerouslySetInnerHTML;
  if (copy.hyperLink !== undefined && !SAFE_LINK_PATTERN.test(copy.hyperLink)) delete copy.hyperLink;
  if (copy.image !== undefined && !isSafeImage(copy.image)) delete copy.image;
  const tags = sanitizeTags(copy.tags);
  if (tags) copy.tags = tags;
  else delete copy.tags;
  const icons = sanitizeIcons(copy.icons);
  if (icons) copy.icons = icons;
  else delete copy.icons;
  if (copy.children) copy.children = copy.children.map(sanitizeNode);
  return copy;
}
```

- [x] **Step 4: Run to verify pass**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-format.test.ts`
Expected: all PASS.

- [x] **Step 5: Commit**

```bash
git add app/src/lib/mindmap-format.ts app/src/lib/mindmap-format.test.ts
git commit -m "fix(mindmap): validate icons, tags and image before rendering"
```

---

### Task 2: XMind converter module

**Files:**
- Modify: `app/package.json`, `app/pnpm-lock.yaml`
- Create: `app/src/lib/xmind-import.ts`
- Test: `app/src/lib/xmind-import.test.ts`

**Interfaces:**
- Consumes: `sanitizeMindmapData(data: MindElixirData): MindElixirData`, `serializeMindmap(data: MindElixirData): string`, `parseMindmap(text: string, fallbackTopic: string): MindmapParseResult` from `./mindmap-format.ts`. From the package: `importXMindFile(file: File): Promise<Sheet[]>`, `convertXmindToMindElixir(sheet: Sheet): MindElixirData`.
- Produces:

```ts
export type XmindImportResult =
  | { ok: true; text: string; extraSheetCount: number }
  | { ok: false; error: string };
export function convertXmind(bytes: Uint8Array, fileName: string): Promise<XmindImportResult>;
```

`text` is a complete `.mmap` file (the Phase 1 envelope). It goes straight into `tab.content`.

- [x] **Step 1: Add dependencies**

```bash
cd app && pnpm add --save-exact @mind-elixir/import-xmind@1.0.8 && pnpm add --save-exact -D jszip@3.10.1
```

Expected: `package.json` has `"@mind-elixir/import-xmind": "1.0.8"` in `dependencies` and `"jszip": "3.10.1"` in `devDependencies`. No peer warnings for `mind-elixir` (import-xmind has no peer dependency on it).

- [x] **Step 2: Write the failing tests** — create `app/src/lib/xmind-import.test.ts`:

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { parseMindmap } from './mindmap-format.ts';
import { convertXmind } from './xmind-import.ts';

async function zipOf(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: 'uint8array' });
}

function topic(id: string, title: string, extra: Record<string, unknown> = {}) {
  return { id, class: 'topic', title, ...extra };
}

const ZEN_SHEETS = [
  {
    id: 's1',
    class: 'sheet',
    title: 'גיליון',
    rootTopic: topic('r', 'מפה ראשית', {
      children: {
        attached: [
          topic('a', 'ענף א', {
            notes: { plain: { content: 'הערה' } },
            labels: ['תווית'],
            href: 'javascript:alert(1)',
            branch: 'folded',
            image: { src: 'xap:resources/x.png', width: 10, height: 10 },
            children: { attached: [topic('a1', 'leaf 1'), topic('a2', 'leaf 2')], summary: [topic('st', 'סיכום')] },
            summaries: [{ id: 'sum', range: '(0,1)', topicId: 'st' }],
          }),
          topic('b', 'Branch B', { href: 'https://example.com' }),
        ],
      },
    }),
    relationships: [{ id: 'rel', end1Id: 'a1', end2Id: 'b', title: '<b>קשר</b>' }],
  },
  { id: 's2', class: 'sheet', title: 'Second', rootTopic: topic('r2', 'Second root') },
];

const LEGACY_XML =
  '<?xml version="1.0" encoding="UTF-8"?><xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0" version="2.0">' +
  '<sheet id="L1"><topic id="lr"><title>שורש</title><children><topics type="attached">' +
  '<topic id="l1" branch="folded"><title>legacy child</title><notes><plain>legacy note</plain></notes></topic>' +
  '</topics></children></topic><title>Legacy</title></sheet></xmap-content>';

async function importOk(bytes: Uint8Array) {
  const result = await convertXmind(bytes, 'map.xmind');
  assert.equal(result.ok, true, result.ok ? '' : result.error);
  if (!result.ok) throw new Error(result.error);
  const parsed = parseMindmap(result.text, 'fallback');
  if (!parsed.ok) throw new Error(parsed.error);
  return { result, data: parsed.data };
}

test('Zen JSON imports the first sheet as a valid .mmap document', async () => {
  const { result, data } = await importOk(await zipOf({ 'content.json': JSON.stringify(ZEN_SHEETS) }));
  assert.equal(result.extraSheetCount, 1);
  assert.equal(data.nodeData.topic, 'מפה ראשית');
  const a = data.nodeData.children?.[0];
  assert.equal(a?.note, 'הערה');
  assert.equal(a?.expanded, false);
  assert.deepEqual(a?.tags, ['תווית']);
  assert.equal(a?.children?.length, 2);
  assert.equal(data.nodeData.children?.[1].hyperLink, 'https://example.com');
  assert.equal(data.summaries?.length, 1);
  assert.equal(data.arrows?.length, 1);
});

test('imported data is sanitized', async () => {
  const { data } = await importOk(await zipOf({ 'content.json': JSON.stringify(ZEN_SHEETS) }));
  const a = data.nodeData.children?.[0];
  assert.equal(a?.hyperLink, undefined);
  assert.equal(a?.image, undefined);
  assert.equal(data.arrows?.[0].label, 'bקשר/b');
});

test('legacy XMind 8 XML imports', async () => {
  const { result, data } = await importOk(await zipOf({ 'content.xml': LEGACY_XML }));
  assert.equal(result.extraSheetCount, 0);
  assert.equal(data.nodeData.topic, 'שורש');
  assert.equal(data.nodeData.children?.[0].note, 'legacy note');
});

test('a topic without a title becomes an empty topic instead of failing', async () => {
  const sheets = [{ id: 's', class: 'sheet', rootTopic: { id: 'r', children: { attached: [{ id: 'c' }] } } }];
  const { data } = await importOk(await zipOf({ 'content.json': JSON.stringify(sheets) }));
  assert.equal(data.nodeData.topic, '');
  assert.equal(data.nodeData.children?.[0].topic, '');
});

test('malformed files return an error instead of throwing', async () => {
  const cases: Uint8Array[] = [
    new TextEncoder().encode('not a zip'),
    await zipOf({ 'other.txt': 'x' }),
    await zipOf({ 'content.json': '[]' }),
    await zipOf({ 'content.json': '{bad json' }),
    await zipOf({ 'content.json': JSON.stringify([{ id: 's', class: 'sheet' }]) }),
  ];
  for (const bytes of cases) {
    const result = await convertXmind(bytes, 'bad.xmind');
    assert.equal(result.ok, false);
  }
});
```

- [x] **Step 3: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/xmind-import.test.ts`
Expected: FAIL — `Cannot find module './xmind-import.ts'`.

- [x] **Step 4: Implement** — create `app/src/lib/xmind-import.ts`:

```ts
import { convertXmindToMindElixir, importXMindFile } from '@mind-elixir/import-xmind';
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { parseMindmap, sanitizeMindmapData, serializeMindmap } from './mindmap-format.ts';

export type XmindImportResult =
  | { ok: true; text: string; extraSheetCount: number }
  | { ok: false; error: string };

type XmindSheet = Parameters<typeof convertXmindToMindElixir>[0];

const NO_SHEETS_ERROR = 'XMind file has no sheets';
const EMPTY_TOPIC = '';

function failure(error: string): XmindImportResult {
  return { ok: false, error };
}

function withStringTopics(node: NodeObj): NodeObj {
  return {
    ...node,
    topic: typeof node.topic === 'string' ? node.topic : EMPTY_TOPIC,
    ...(Array.isArray(node.children) ? { children: node.children.map(withStringTopics) } : {}),
  };
}

function toMindmapText(data: MindElixirData): XmindImportResult {
  const clean = sanitizeMindmapData({ ...data, nodeData: withStringTopics(data.nodeData) });
  const text = serializeMindmap(clean);
  const check = parseMindmap(text, EMPTY_TOPIC);
  return check.ok ? { ok: true, text, extraSheetCount: 0 } : failure(check.error);
}

async function readSheets(bytes: Uint8Array, fileName: string): Promise<XmindSheet[]> {
  const sheets: unknown = await importXMindFile(new File([bytes], fileName));
  if (!Array.isArray(sheets) || sheets.length === 0) throw new Error(NO_SHEETS_ERROR);
  return sheets as XmindSheet[];
}

export async function convertXmind(bytes: Uint8Array, fileName: string): Promise<XmindImportResult> {
  try {
    const sheets = await readSheets(bytes, fileName);
    const result = toMindmapText(convertXmindToMindElixir(sheets[0]));
    return result.ok ? { ...result, extraSheetCount: sheets.length - 1 } : result;
  } catch (err) {
    return failure(err instanceof Error ? err.message : String(err));
  }
}
```

Notes for the implementer:
- `importXMindFile` calls `console.log` / `console.error` on every file it loads (library behavior). Leave it.
- If `vue-tsc` rejects `new File([bytes], …)` (`Uint8Array<ArrayBufferLike>` vs `BlobPart`), pass `bytes.slice().buffer` instead. Do not cast to `any`.

- [x] **Step 5: Run to verify pass**

Run: `cd app && node --test --experimental-strip-types src/lib/xmind-import.test.ts src/lib/mindmap-format.test.ts`
Expected: all PASS.

- [x] **Step 6: Commit**

```bash
git add app/package.json app/pnpm-lock.yaml app/src/lib/xmind-import.ts app/src/lib/xmind-import.test.ts
git commit -m "feat(mindmap): convert .xmind files into sanitized .mmap documents"
```

---

### Task 3: Open `.xmind` as an imported tab; Save As `.mmap`

**Files:**
- Modify: `app/src/lib/mindmap-format.ts` (constants + path helpers near `isMindmapPath`, lines 3–4 and 25–33)
- Modify: `app/src/lib/mindmap-format.test.ts` (test `'Phase 1 recognizes only .mmap'`, lines 15–21)
- Modify: `app/src/lib/file-language.test.ts` (test at line 43)
- Modify: `app/src/types.ts` (`Tab`, lines 21–37)
- Modify: `app/src/stores/tabs.ts` (`newTab`, lines 179–196)
- Modify: `app/src/composables/useFiles.ts` (imports ~line 21; `TEXT_LINK_EXTENSIONS` ~line 122; `openPath` before the `CONVERT_BUILTIN` check ~line 296; `saveTabAs` ~lines 781–806)
- Modify: `app/src/components/FileTree.vue` (icon map ~line 1899)

**Interfaces:**
- Consumes: `convertXmind(bytes: Uint8Array, fileName: string): Promise<XmindImportResult>` (Task 2), loaded with a dynamic `import()` so the XMind parser stays out of the main bundle.
- Produces:
  - `mindmap-format.ts`: `export const XMIND_EXTENSION = 'xmind'`; `MINDMAP_EXTENSIONS = ['mmap', 'xmind']`; `export function isXmindPath(path: string): boolean`; `export function mmapPathFor(sourcePath: string): string`.
  - `Tab.importedFrom?: string` — absolute path of the source `.xmind`. Set only on path-less tabs.
  - `tabs.newTab(opts?: { fileName?: string; language?: Language; importedFrom?: string })`.

- [x] **Step 1: Write the failing tests**

In `app/src/lib/mindmap-format.test.ts`, add `isXmindPath` and `mmapPathFor` to the import list. Replace the test `'Phase 1 recognizes only .mmap'` with:

```ts
test('mindmap extensions are .mmap and .xmind', () => {
  assert.deepEqual([...MINDMAP_EXTENSIONS], ['mmap', 'xmind']);
  assert.equal(isMindmapPath('/notes/Plan.MMAP'), true);
  assert.equal(isMindmapPath('C:\\maps\\plan.mmap'), true);
  assert.equal(isMindmapPath('/maps/Old.XMind'), true);
  assert.equal(isMindmapPath('/notes/plan.md'), false);
  assert.equal(isMindmapPath('mmap'), false);
});

test('isXmindPath matches only .xmind', () => {
  assert.equal(isXmindPath('/maps/Old.XMIND'), true);
  assert.equal(isXmindPath('/maps/plan.mmap'), false);
  assert.equal(isXmindPath('xmind'), false);
});

test('mmapPathFor swaps the extension and keeps the folder', () => {
  assert.equal(mmapPathFor('/Users/me/maps/ledger v1.3.xmind'), '/Users/me/maps/ledger v1.3.mmap');
  assert.equal(mmapPathFor('C:\\maps\\מפה.xmind'), 'C:\\maps\\מפה.mmap');
  assert.equal(mmapPathFor('/maps.d/noext'), '/maps.d/noext.mmap');
});
```

In `app/src/lib/file-language.test.ts`, add to the test at line 43:

```ts
  assert.equal(inferFileLanguage('/maps/Old.xmind'), 'mindmap');
```

- [x] **Step 2: Run to verify failure**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-format.test.ts src/lib/file-language.test.ts`
Expected: FAIL — `isXmindPath` / `mmapPathFor` not exported; `.xmind` infers `plaintext`.

- [x] **Step 3: Implement the helpers** in `app/src/lib/mindmap-format.ts`:

```ts
export const MMAP_EXTENSION = 'mmap';
export const XMIND_EXTENSION = 'xmind';
export const MINDMAP_EXTENSIONS: readonly string[] = [MMAP_EXTENSION, XMIND_EXTENSION];
```

Add after `isMindmapPath`:

```ts
const TRAILING_EXTENSION_PATTERN = /\.[^.\\/]+$/;

export function isXmindPath(path: string): boolean {
  return extensionOf(path) === XMIND_EXTENSION;
}

export function mmapPathFor(sourcePath: string): string {
  return `${sourcePath.replace(TRAILING_EXTENSION_PATTERN, '')}.${MMAP_EXTENSION}`;
}
```

Run Step 2's command again. Expected: PASS.

- [x] **Step 4: Tab field + store**

`app/src/types.ts`, inside `interface Tab` after `showOutline?: boolean;`:

```ts
  /** Source path of an imported file (e.g. `.xmind`). The tab has no
   *  `filePath`, so saving always goes through Save As. */
  importedFrom?: string;
```

`app/src/stores/tabs.ts`, `newTab`: widen the options and set the field on the object **before** `this.tabs.push(tab)`, so it is reactive:

```ts
    newTab(opts?: { fileName?: string; language?: Language; importedFrom?: string }) {
```

and inside the `tab` literal, after `showOutline: …,`:

```ts
        ...(opts?.importedFrom ? { importedFrom: opts.importedFrom } : {}),
```

- [x] **Step 5: `useFiles.ts` — open**

Change the mindmap import line to:

```ts
import { MMAP_EXTENSION, MINDMAP_EXTENSIONS, isXmindPath, mmapPathFor } from '../lib/mindmap-format';
```

Add `...MINDMAP_EXTENSIONS,` as the last entry of the `TEXT_LINK_EXTENSIONS` set, so a Markdown link to a map always opens in-app (XMind desktop is being uninstalled).

Add inside `useFiles()` next to `openAndConvert`:

```ts
  async function openXmind(path: string): Promise<void> {
    const existing = tabs.tabs.find((t) => t.importedFrom === path);
    if (existing) {
      tabs.activate(existing.id);
      return;
    }
    const fileName = fileNameOf(path);
    try {
      const bytes = new Uint8Array(await invoke<number[]>('read_binary_file', { path }));
      const { convertXmind } = await import('../lib/xmind-import');
      const result = await convertXmind(bytes, fileName);
      if (!result.ok) {
        toasts.error(`Failed to open ${fileName}: ${result.error}`);
        return;
      }
      const tab = tabs.newTab({ fileName: fileNameOf(mmapPathFor(path)), language: 'mindmap', importedFrom: path });
      tabs.setContent(tab.id, result.text);
      workspace.pushRecent(path);
      toasts.success(`Imported ${fileName} — saving creates a .${MMAP_EXTENSION} file`);
      if (result.extraSheetCount > 0) {
        toasts.warning(`${fileName}: only the first sheet was imported (${result.extraSheetCount} more not imported)`, XMIND_SHEET_WARNING_MS);
      }
    } catch (e) {
      console.error('xmind import failed', e);
      toasts.error(`Failed to open ${fileName}: ${e}`);
    }
  }
```

Add at module level next to `SAVE_FILTERS`:

```ts
const XMIND_SHEET_WARNING_MS = 8000;
```

In `openPath`, directly before `// If it's a convertible format, convert to Markdown first.`:

```ts
    if (isXmindPath(path)) {
      return openXmind(path);
    }
```

If `openXmind` grows past ~20 lines once formatted, extract the two toasts into `announceXmindImport(fileName: string, extraSheetCount: number): void`.

- [x] **Step 6: `useFiles.ts` — Save As default + `.xmind` guard**

In `saveTabAs`, replace the `dir` computation and `saveDialog` call with:

```ts
      const importedPath = tab.importedFrom ? mmapPathFor(tab.importedFrom) : undefined;
      const dir = tab.filePath || importedPath
        ? null
        : await pickerStartDir(newFileDirFor(treeSelection(), tabs.activeTab?.filePath));
      path = await saveDialog({
        defaultPath: tab.filePath ?? importedPath ?? (dir ? joinInFolder(dir, defaultName) : defaultName),
        filters: SAVE_FILTERS,
      });
      if (!path) return false;
      if (isXmindPath(path)) {
        toasts.error(`SoloMD does not write .xmind files — save as .${MMAP_EXTENSION}`);
        return false;
      }
```

Keep the existing comment block above `dir` and extend it with one line: imported tabs default to the sibling `.mmap` of their source.

- [x] **Step 7: File tree icon** — `app/src/components/FileTree.vue`, change `'mmap': '🧠',` to:

```ts
        'mmap': '🧠', 'xmind': '🧠',
```

- [x] **Step 8: Verify**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-format.test.ts src/lib/file-language.test.ts src/lib/xmind-import.test.ts && pnpm build`
Expected: tests PASS; `vue-tsc` clean; `vite build` emits a separate chunk containing `import-xmind`.

- [x] **Step 9: Commit**

```bash
git add app/src/lib/mindmap-format.ts app/src/lib/mindmap-format.test.ts app/src/lib/file-language.test.ts app/src/types.ts app/src/stores/tabs.ts app/src/composables/useFiles.ts app/src/components/FileTree.vue
git commit -m "feat(mindmap): open .xmind as an imported map that saves as .mmap"
```

---

### Task 4: Native routing and file association

**Files:**
- Modify: `app/src-tauri/src/commands.rs:1092`
- Modify: `app/src-tauri/src/main.rs:78`
- Modify: `app/src-tauri/tauri.conf.json` (`fileAssociations`, after the `mmap` entry ~line 84)
- Test: `app/src-tauri/tests/read_file_test.rs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `detect_language("x.xmind") == "mindmap"`. CLI and Finder "Open With" pass `.xmind` paths to the frontend, which routes them through `openXmind` (Task 3).

- [x] **Step 1: Write the failing test** — append to `app/src-tauri/tests/read_file_test.rs`:

```rust
#[test]
fn detect_xmind_language() {
    let path = "/tmp/solomd-lang.xmind".to_string();
    fs::write(&path, "PK").unwrap();
    let r = read_file(path).unwrap();
    assert_eq!(r.language, "mindmap");
}
```

- [x] **Step 2: Run to verify failure**

Run: `cd app/src-tauri && cargo test --test read_file_test detect_xmind_language`
Expected: FAIL — `left: "plaintext"`, `right: "mindmap"`.

- [x] **Step 3: Implement**

`commands.rs:1092`:

```rust
        "mmap" | "xmind" => "mindmap".to_string(),
```

`main.rs:78`:

```rust
                            "md" | "markdown" | "mdown" | "mkd" | "txt" | "mmap" | "xmind"
```

`tauri.conf.json`, add a new entry after the `mmap` association:

```json
      {
        "ext": [
          "xmind"
        ],
        "name": "XMind Map",
        "description": "XMind mind map (opens as an imported SoloMD mindmap)",
        "role": "Viewer",
        "mimeType": "application/vnd.xmind.workbook"
      }
```

`role: "Viewer"` is deliberate: SoloMD reads `.xmind` but never writes it.

- [x] **Step 4: Run to verify pass**

Run: `cd app/src-tauri && cargo test --test read_file_test`
Expected: `detect_xmind_language` and `detect_mindmap_language` PASS. The pre-existing `.rs` assertion failure, if hit, is out of scope.

- [x] **Step 5: Commit**

```bash
git add app/src-tauri/src/commands.rs app/src-tauri/src/main.rs app/src-tauri/tauri.conf.json app/src-tauri/tests/read_file_test.rs
git commit -m "feat(mindmap): route .xmind through native open and file association"
```

---

### Task 5: Browser verification, docs, version bump

**Files:**
- Modify: `docs/design/mindmap/2026-10-11-mindmap-design.md` (phase table + Phase 2 section)
- Modify: `docs/plans/mindmap/2026-10-11-mindmap-phase2-xmind.md` (Status)
- Modify: `app/package.json`, `app/src-tauri/Cargo.toml`, `app/src-tauri/Cargo.lock` (the `solomd` package entry), `app/src-tauri/tauri.conf.json` — version `4.14.9` → `4.14.10`

**Interfaces:**
- Consumes: everything above.
- Produces: verified feature, updated docs, Phase 3 handoff prompt.

- [x] **Step 1: Browser check (Vite web, no Tauri)**

Start `solomd-web` from `.claude/launch.json` (port 1420). `read_binary_file` is not available in the web build, so drive the converter directly from the page console:

```js
const JSZip = (await import('/node_modules/.vite/deps/jszip.js')).default;
const zip = new JSZip();
zip.file('content.json', JSON.stringify([{ id: 's', class: 'sheet', title: 'ש', rootTopic: { id: 'r', title: 'מפה', children: { attached: [{ id: 'a', title: 'ענף', labels: ['tag'], notes: { plain: { content: 'note' } } }, { id: 'b', title: 'Branch', branch: 'folded', children: { attached: [{ id: 'b1', title: 'hidden' }] } }] } } }, { id: 's2', class: 'sheet', rootTopic: { id: 'r2', title: 'x' } }]));
const bytes = await zip.generateAsync({ type: 'uint8array' });
const { convertXmind } = await import('/src/lib/xmind-import.ts');
const result = await convertXmind(bytes, 'demo.xmind');
const tabs = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('tabs');
const tab = tabs.newTab({ fileName: 'demo.mmap', language: 'mindmap', importedFrom: '/tmp/demo.xmind' });
tabs.setContent(tab.id, result.text);
result.extraSheetCount;
```

If the `.vite/deps/jszip.js` path 404s, import from `/node_modules/jszip/dist/jszip.min.js` instead.

Verify with `read_page` + a screenshot:
- The map renders RTL with root `מפה`. `ענף` shows a tag and a note marker. `Branch` is collapsed.
- `extraSheetCount` is `1`.
- The tab is dirty, and its title is `demo.mmap`.
- No console errors from SoloMD code. Library `console.log` output is expected.

- [x] **Step 2: Full check**

Run: `cd app && node --test --experimental-strip-types src/lib/mindmap-format.test.ts src/lib/xmind-import.test.ts src/lib/file-language.test.ts src/lib/mindmap-direction.test.ts src/lib/mindmap-keymap.test.ts src/lib/keybindings.test.ts && pnpm build`
Expected: all PASS, build clean.

- [x] **Step 3: Docs**
- Spec phase table: mark Phase 2 done (`4.14.10`).
- Spec Phase 2 section: replace the conditional export bullet with: "`@mind-elixir/export-xmind` was rejected (lossy, peer range core 2–3). Saving an imported `.xmind` tab opens Save As at the sibling `.mmap`; `.xmind` targets are refused."
- This plan's Status: completion date, commits per task, deviations, open items. Open items include the native Tauri check for Phase 1 and Phase 2: open each of `/Users/ofeki/works/tools-ledger/*.xmind` via Finder, save, and confirm the `.xmind` is unchanged.

- [x] **Step 4: Version bump** — `4.14.9` → `4.14.10` in all 4 files. For `Cargo.lock`, edit only the `version` line under `name = "solomd"`.

- [x] **Step 5: Commit (two commits, matching Phase 1)**

```bash
git add docs/superpowers
git commit -m "docs(mindmap): mark phase 2 complete in plan and spec"
git add app/package.json app/src-tauri/Cargo.toml app/src-tauri/Cargo.lock app/src-tauri/tauri.conf.json
git commit -m "chore(release): bump version to 4.14.10"
```

- [x] **Step 6: Phase 3 handoff prompt** — write it in chat. It follows the shape of the Phase 2 prompt: context, what Phases 1–2 built, Phase 3 scope from the spec (Markdown `mindmap` fence), constraints, process.
