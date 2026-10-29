# Settings IA: Theme Studio Tab + Two-Level Nav — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Theme Studio out of the Settings modal into its own editor tab, and give Settings a fixed-size two-level navigation (category → page).

**Architecture:** Theme Studio becomes a virtual tab (`language: 'theme-studio'`), modelled on the existing git-diff tab. Settings navigation is driven by one pure table, `lib/settings-nav.ts`. Each template block carries `data-page="<cat>/<page>"`, and one generated CSS rule shows the active page. A node test guards the template against blocks with no page.

**Tech Stack:** Vue 3 + Pinia, TypeScript, `node --test` (type-stripping, `.ts` import extensions), vue-tsc, Vite.

**Spec:** `docs/superpowers/specs/2026-10-29-settings-ia-design.md`

## Global Constraints

- Category ids stay `basics | theme | writing | mindmap | sync | integrations | export | keys | advanced` (deep links depend on them).
- Labels: `settings.catBasics` → "General"; `themeStudio.navLabel` → "Appearance".
- Modal size: width `min(960px, 92vw)`; layout height `min(640px, 72vh)`. Never changes per page.
- New strings go in `app/src/i18n/en.ts` only (other locales fall back to English).
- Studio tab: never persisted, never auto-saved, never written to disk.
- Tests: `pnpm --dir app test`. Types and build: `pnpm --dir app build`.
- Commit after each task. End every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Map

| File | Change |
| --- | --- |
| `app/src/lib/virtual-tabs.ts` (new) | `isVirtualLanguage()`: which tab languages have no file |
| `app/src/lib/settings-nav.ts` (new) | Nav tree, page keys, parse, breadcrumb, visibility CSS |
| `app/src/lib/settings-nav.test.ts` (new) | Unit tests for the nav model |
| `app/src/lib/settings-nav.template.test.ts` (new) | Guard: every block in `SettingsPanel.vue` has a valid `data-page` |
| `app/src/types.ts` | `Language` gains `'theme-studio'` |
| `app/src/stores/tabs.ts` | `openThemeStudio()`, virtual-aware `isDirty` and `persistableTabs` |
| `app/src/composables/useThemeStudio.ts` | `registerSave`, `saveDraft`, `resetDraft` |
| `app/src/composables/useFiles.ts` | Save guards; close flow for the Studio tab |
| `app/src/lib/auto-save.ts` | Use `isVirtualLanguage` |
| `app/src/components/ThemeStudioTab.vue` (new) | Two-column tab shell |
| `app/src/components/ThemeStudio.vue` | Teleport target rename; register save |
| `app/src/components/PaneContent.vue` | Render the Studio tab |
| `app/src/composables/useCommands.ts` | `view.themeStudio` opens the tab |
| `app/src/components/SettingsPanel.vue` | Appearance page, tree nav, pages, breadcrumb, fixed size |
| `app/src/i18n/en.ts` | New labels |

---

### Task 1: Virtual-tab helper and `theme-studio` language

**Files:**
- Create: `app/src/lib/virtual-tabs.ts`, `app/src/lib/virtual-tabs.test.ts`
- Modify: `app/src/types.ts:1`, `app/src/stores/tabs.ts:135-138,205-207`, `app/src/composables/useFiles.ts:797,868`, `app/src/lib/auto-save.ts:18,23`, `app/src/components/PaneContent.vue:33-37`

**Interfaces:**
- Produces: `isVirtualLanguage(lang: string | undefined): boolean`; `Language` includes `'theme-studio'`.

- [ ] **Step 1: Write the failing test** `app/src/lib/virtual-tabs.test.ts`

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isVirtualLanguage } from './virtual-tabs.ts';

test('git-diff and theme-studio tabs have no file behind them', () => {
  assert.equal(isVirtualLanguage('git-diff'), true);
  assert.equal(isVirtualLanguage('theme-studio'), true);
});

test('document languages are real files', () => {
  assert.equal(isVirtualLanguage('markdown'), false);
  assert.equal(isVirtualLanguage('mindmap'), false);
  assert.equal(isVirtualLanguage(undefined), false);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --dir app exec node --test src/lib/virtual-tabs.test.ts`
Expected: FAIL, cannot find module `./virtual-tabs.ts`.

- [ ] **Step 3: Implement** `app/src/lib/virtual-tabs.ts`

```ts
import type { Language } from '../types';

const VIRTUAL_LANGUAGES: ReadonlySet<string> = new Set<Language>(['git-diff', 'theme-studio']);

export function isVirtualLanguage(lang: string | undefined): boolean {
  return lang !== undefined && VIRTUAL_LANGUAGES.has(lang);
}
```

In `app/src/types.ts` line 1, add `'theme-studio'` after `'git-diff'` in the `Language` union.

- [ ] **Step 4: Swap the scattered guards**

`app/src/stores/tabs.ts`: add `import { isVirtualLanguage } from '../lib/virtual-tabs';`, then:

```ts
function isDirty(t: Tab): boolean {
  if (isVirtualLanguage(t.language)) return false;
  return t.content !== t.savedContent;
}
```

```ts
    persistableTabs(state): Tab[] {
      return state.tabs.filter((t) => !isVirtualLanguage(t.language));
    },
```

Leave line 496 (`closes git-diff tabs on workspace switch`) as it is. The Studio tab survives a workspace switch.

`app/src/composables/useFiles.ts`: import `isVirtualLanguage`. In `saveTab` (line 797) and `saveTabAs` (line 868), replace `if (tab.language === 'git-diff') return false;` with `if (isVirtualLanguage(tab.language)) return false;`.

`app/src/lib/auto-save.ts`: delete `UNSAVABLE_LANGUAGES`, import `{ isVirtualLanguage } from './virtual-tabs.ts'`, and change line 23 to `if (isVirtualLanguage(tab.language)) return false;`.

`app/src/components/PaneContent.vue`: import `isVirtualLanguage` and change `showEditor` to:

```ts
const showEditor = computed(
  () => !isMindmap.value && !isVirtualLanguage(props.tab?.language) && (props.tab?.language !== 'markdown' || settings.viewMode !== 'preview')
);
```

- [ ] **Step 5: Run tests and types**

Run: `pnpm --dir app test && pnpm --dir app exec vue-tsc --noEmit`
Expected: all pass. The existing `auto-save.test.ts` still passes.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/virtual-tabs.ts app/src/lib/virtual-tabs.test.ts app/src/types.ts app/src/stores/tabs.ts app/src/composables/useFiles.ts app/src/lib/auto-save.ts app/src/components/PaneContent.vue
git commit -m "refactor(tabs): one isVirtualLanguage guard for file-less tabs"
```

---

### Task 2: Theme Studio as a singleton tab

**Files:**
- Create: `app/src/components/ThemeStudioTab.vue`
- Modify: `app/src/composables/useThemeStudio.ts`, `app/src/components/ThemeStudio.vue:290-296,309`, `app/src/stores/tabs.ts`, `app/src/composables/useFiles.ts` (`closeTabSafe`, around line 970), `app/src/components/PaneContent.vue:28-34,471`, `app/src/composables/useCommands.ts:299`, `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: `isVirtualLanguage` (Task 1).
- Produces: `tabs.openThemeStudio(): void`; `useThemeStudio()` also returns `registerSave(fn: () => Promise<boolean>): () => void`, `saveDraft(): Promise<boolean>` and `resetDraft(): void`; constant `THEME_STUDIO_PREVIEW_ID = 'theme-studio-preview'`, exported from `useThemeStudio.ts`.

- [ ] **Step 1: Extend the composable** `app/src/composables/useThemeStudio.ts`

Add `shallowRef` to the vue import, then add after the `flash` ref:

```ts
export const THEME_STUDIO_PREVIEW_ID = 'theme-studio-preview';

const saveHandler = shallowRef<(() => Promise<boolean>) | null>(null);

function registerSave(fn: () => Promise<boolean>): () => void {
  saveHandler.value = fn;
  return () => {
    if (saveHandler.value === fn) saveHandler.value = null;
  };
}

function saveDraft(): Promise<boolean> {
  return saveHandler.value ? saveHandler.value() : Promise.resolve(false);
}

function resetDraft(): void {
  draft.value = null;
  savedSnapshot.value = '';
}
```

Change the return to:

```ts
export function useThemeStudio() {
  return { studioOpen, draft, savedSnapshot, isDirty, previewFamily, flash, registerSave, saveDraft, resetDraft };
}
```

- [ ] **Step 2: ThemeStudio registers its save and targets the tab's preview slot**

In `app/src/components/ThemeStudio.vue`:
- Add `onUnmounted` to the vue import, and import `THEME_STUDIO_PREVIEW_ID` alongside `useThemeStudio`.
- Destructure `registerSave` where `useThemeStudio()` is already called.
- Line 309: `<Teleport defer :to="'#' + THEME_STUDIO_PREVIEW_ID">`.
- After the `onMounted` block, add:

```ts
const unregisterSave = registerSave(save);
onUnmounted(unregisterSave);
```

- [ ] **Step 3: Create** `app/src/components/ThemeStudioTab.vue`

```vue
<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import ThemeStudio from './ThemeStudio.vue';
import { THEME_STUDIO_PREVIEW_ID, useThemeStudio } from '../composables/useThemeStudio';

const { studioOpen } = useThemeStudio();
onMounted(() => { studioOpen.value = true; });
onUnmounted(() => { studioOpen.value = false; });
</script>

<template>
  <div class="studio-tab">
    <aside :id="THEME_STUDIO_PREVIEW_ID" class="studio-tab__preview" />
    <main class="studio-tab__controls"><ThemeStudio /></main>
  </div>
</template>

<style scoped>
.studio-tab {
  display: grid;
  grid-template-columns: minmax(280px, 2fr) 3fr;
  gap: var(--sp-4);
  height: 100%;
  padding: var(--sp-4);
  overflow: hidden;
  background: var(--bg);
}
.studio-tab__preview { overflow-y: auto; }
.studio-tab__controls { overflow-y: auto; min-width: 0; }
@media (max-width: 760px) {
  .studio-tab { grid-template-columns: 1fr; grid-template-rows: auto 1fr; overflow-y: auto; }
}
</style>
```

The grid uses logical order, so in RTL the preview sits on the right without extra CSS.

- [ ] **Step 4: Tabs store opens one Studio tab and reports its dirty state**

`app/src/stores/tabs.ts`: import `{ useThemeStudio } from '../composables/useThemeStudio'`. That import is only called inside functions, so the ESM cycle through the theme and settings stores is safe. Do not import i18n into the store; the title is a constant:

```ts
const THEME_STUDIO_TITLE = 'Theme Studio';
```

Change `isDirty` so the Studio tab reports the draft:

```ts
function isDirty(t: Tab): boolean {
  if (t.language === 'theme-studio') return useThemeStudio().isDirty.value;
  if (isVirtualLanguage(t.language)) return false;
  return t.content !== t.savedContent;
}
```

Add the action next to `openGitDiff`:

```ts
    openThemeStudio() {
      const existing = this.tabs.find((x) => x.language === 'theme-studio');
      if (existing) {
        this.activeId = existing.id;
        return;
      }
      this.newTab({ fileName: THEME_STUDIO_TITLE, language: 'theme-studio' });
    },
```

- [ ] **Step 5: Close flow asks before dropping a draft**

`app/src/composables/useFiles.ts`: import `useThemeStudio`. Add inside the composable, before `closeTabSafe`:

```ts
  async function closeThemeStudioTab(id: string): Promise<void> {
    const studio = useThemeStudio();
    const showUnsavedDialog = getUnsavedDialog();
    if (studio.isDirty.value && showUnsavedDialog) {
      const action = await showUnsavedDialog('tab', t('themeStudio.tabTitle'), 1);
      if (action === 'cancel') return;
      if (action === 'save' && !(await studio.saveDraft())) return;
    }
    studio.resetDraft();
    tabs.closeTab(id);
  }
```

In `closeTabSafe`, right after the `tab.pinned` guard, add:

```ts
    if (tab.language === 'theme-studio') return closeThemeStudioTab(id);
```

- [ ] **Step 6: Render the tab and repoint the command**

`app/src/components/PaneContent.vue`:

```ts
const ThemeStudioTab = defineAsyncComponent(() => import('./ThemeStudioTab.vue'));
const isThemeStudio = computed(() => props.tab?.language === 'theme-studio');
```

Template, directly after the git-diff pane (line 473):

```vue
    <div class="pane pane--theme-studio" v-if="isThemeStudio && tab">
      <ThemeStudioTab :key="tab.id" />
    </div>
```

`app/src/composables/useCommands.ts:299`: change `run` to `() => tabs.openThemeStudio()`.

`app/src/i18n/en.ts`, inside `themeStudio`: add `tabTitle: 'Theme Studio',` and `openInTab: 'Customize in Theme Studio',`. Change `navLabel` to `'Appearance'`.

- [ ] **Step 7: Run tests and types**

Run: `pnpm --dir app test && pnpm --dir app exec vue-tsc --noEmit`
Expected: pass. Between this task and Task 5, the Studio embedded in Settings has no Teleport target, so it logs a Vue warning and shows no mocks there. That is expected, and Task 5 removes the embed.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/ThemeStudioTab.vue app/src/components/ThemeStudio.vue app/src/composables/useThemeStudio.ts app/src/stores/tabs.ts app/src/composables/useFiles.ts app/src/components/PaneContent.vue app/src/composables/useCommands.ts app/src/i18n/en.ts
git commit -m "feat(theme): open Theme Studio as its own editor tab"
```

---

### Task 3: Settings navigation model

**Files:**
- Create: `app/src/lib/settings-nav.ts`, `app/src/lib/settings-nav.test.ts`

**Interfaces:**
- Produces:
  - `type SettingsCategory`
  - `type PageKey = string` (format `<cat>/<page>`)
  - `SETTINGS_NAV: readonly NavCategory[]`
  - `ALL_PAGE_KEYS: readonly PageKey[]`
  - `defaultPage(cat: SettingsCategory): PageKey`
  - `parsePageKey(raw: string | null | undefined): PageKey | null`
  - `categoryOf(key: PageKey): SettingsCategory`
  - `crumbsOf(key: PageKey): { categoryLabelKey: string; pageLabelKey: string | null }`
  - `isMultiPage(cat: SettingsCategory): boolean`
  - `pageVisibilityCss(key: PageKey | null): string`

- [ ] **Step 1: Write the failing tests** `app/src/lib/settings-nav.test.ts`

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_PAGE_KEYS, categoryOf, crumbsOf, defaultPage, isMultiPage, pageVisibilityCss, parsePageKey } from './settings-nav.ts';

test('a bare category resolves to its first page, including keys', () => {
  assert.equal(parsePageKey('keys'), 'keys/main');
  assert.equal(parsePageKey('basics'), 'basics/language');
  assert.equal(parsePageKey('theme'), 'theme/main');
});

test('a full page key passes through, an unknown one is rejected', () => {
  assert.equal(parsePageKey('writing/image-upload'), 'writing/image-upload');
  assert.equal(parsePageKey('writing/nope'), null);
  assert.equal(parsePageKey('nope'), null);
  assert.equal(parsePageKey(null), null);
});

test('page keys are unique and know their category', () => {
  assert.equal(new Set(ALL_PAGE_KEYS).size, ALL_PAGE_KEYS.length);
  assert.equal(categoryOf('advanced/files'), 'advanced');
  assert.equal(defaultPage('advanced'), 'advanced/startup');
});

test('single-page categories show no page crumb', () => {
  assert.equal(isMultiPage('keys'), false);
  assert.deepEqual(crumbsOf('keys/main'), { categoryLabelKey: 'settings.catKeys', pageLabelKey: null });
  assert.deepEqual(crumbsOf('writing/focus'), { categoryLabelKey: 'settings.catWriting', pageLabelKey: 'settings.pageFocus' });
});

test('visibility css only ever names a known page', () => {
  assert.match(pageVisibilityCss('basics/fonts'), /\[data-page="basics\/fonts"\]/);
  assert.equal(pageVisibilityCss('x"]{}*{display:none'), '');
  assert.equal(pageVisibilityCss(null), '');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --dir app exec node --test src/lib/settings-nav.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement** `app/src/lib/settings-nav.ts`

```ts
export type SettingsCategory = 'basics' | 'theme' | 'writing' | 'mindmap' | 'sync' | 'integrations' | 'export' | 'keys' | 'advanced';
export type PageKey = string;

export interface NavPage {
  id: string;
  labelKey: string;
}

export interface NavCategory {
  id: SettingsCategory;
  icon: string;
  labelKey: string;
  pages: readonly NavPage[];
}

const MAIN = 'main';

function single(id: SettingsCategory, icon: string, labelKey: string): NavCategory {
  return { id, icon, labelKey, pages: [{ id: MAIN, labelKey }] };
}

export const SETTINGS_NAV: readonly NavCategory[] = [
  {
    id: 'basics', icon: '⚙️', labelKey: 'settings.catBasics', pages: [
      { id: 'language', labelKey: 'settings.pageLanguage' },
      { id: 'fonts', labelKey: 'settings.pageFonts' },
      { id: 'editor', labelKey: 'settings.pageEditor' },
      { id: 'sidebar', labelKey: 'settings.pageSidebar' },
      { id: 'preview', labelKey: 'settings.pagePreview' },
    ],
  },
  single('theme', '🎨', 'themeStudio.navLabel'),
  {
    id: 'writing', icon: '✍️', labelKey: 'settings.catWriting', pages: [
      { id: 'aids', labelKey: 'settings.pageAids' },
      { id: 'focus', labelKey: 'settings.pageFocus' },
      { id: 'attachments', labelKey: 'settings.pageAttachments' },
      { id: 'image-upload', labelKey: 'settings.pageImageUpload' },
      { id: 'inbox', labelKey: 'settings.pageInbox' },
    ],
  },
  single('mindmap', '🧠', 'settings.catMindmap'),
  single('sync', '☁️', 'settings.catSync'),
  single('integrations', '🔌', 'settings.catIntegrations'),
  single('export', '📤', 'settings.catExport'),
  single('keys', '⌨️', 'settings.catKeys'),
  {
    id: 'advanced', icon: '🛠️', labelKey: 'settings.catAdvanced', pages: [
      { id: 'startup', labelKey: 'settings.pageStartup' },
      { id: 'files', labelKey: 'settings.pageFiles' },
      { id: 'updates', labelKey: 'settings.pageUpdates' },
    ],
  },
];

const KEY_SEPARATOR = '/';

function keyOf(cat: SettingsCategory, page: string): PageKey {
  return `${cat}${KEY_SEPARATOR}${page}`;
}

export const ALL_PAGE_KEYS: readonly PageKey[] = SETTINGS_NAV.flatMap((c) => c.pages.map((p) => keyOf(c.id, p.id)));
const KNOWN_KEYS = new Set(ALL_PAGE_KEYS);

function findCategory(id: string): NavCategory | undefined {
  return SETTINGS_NAV.find((c) => c.id === id);
}

export function defaultPage(cat: SettingsCategory): PageKey {
  const found = findCategory(cat);
  return keyOf(cat, found ? found.pages[0].id : MAIN);
}

export function parsePageKey(raw: string | null | undefined): PageKey | null {
  if (!raw) return null;
  if (KNOWN_KEYS.has(raw)) return raw;
  const cat = findCategory(raw);
  return cat ? defaultPage(cat.id) : null;
}

export function categoryOf(key: PageKey): SettingsCategory {
  return key.split(KEY_SEPARATOR)[0] as SettingsCategory;
}

export function isMultiPage(cat: SettingsCategory): boolean {
  return (findCategory(cat)?.pages.length ?? 0) > 1;
}

export function crumbsOf(key: PageKey): { categoryLabelKey: string; pageLabelKey: string | null } {
  const cat = findCategory(categoryOf(key));
  if (!cat) return { categoryLabelKey: '', pageLabelKey: null };
  const pageId = key.slice(cat.id.length + KEY_SEPARATOR.length);
  const page = cat.pages.find((p) => p.id === pageId);
  return { categoryLabelKey: cat.labelKey, pageLabelKey: isMultiPage(cat.id) && page ? page.labelKey : null };
}

export function pageVisibilityCss(key: PageKey | null): string {
  if (!key || !KNOWN_KEYS.has(key)) return '';
  return `.settings__body[data-active-page="${key}"] > [data-page="${key}"] { display: flex; flex-direction: column; gap: 8px; }`;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `pnpm --dir app exec node --test src/lib/settings-nav.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/settings-nav.ts app/src/lib/settings-nav.test.ts
git commit -m "feat(settings): two-level navigation model"
```

---

### Task 4: Tag every Settings block with its page (plus the template guard)

**Files:**
- Create: `app/src/lib/settings-nav.template.test.ts`
- Modify: `app/src/components/SettingsPanel.vue` (template blocks from about line 754 to line 2262)

**Interfaces:**
- Consumes: `ALL_PAGE_KEYS`, `categoryOf` (Task 3).

- [ ] **Step 1: Write the failing guard test** `app/src/lib/settings-nav.template.test.ts`

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ALL_PAGE_KEYS, categoryOf } from './settings-nav.ts';

const PANEL = readFileSync(new URL('../components/SettingsPanel.vue', import.meta.url), 'utf8');
const BLOCK_OPEN = /^ {8}<(?:section|div)\b[^>]*\bdata-cat="([a-z]+)"[^>]*>/gm;

function blocks(): { cat: string; page: string | null; line: string }[] {
  return [...PANEL.matchAll(BLOCK_OPEN)].map((m) => ({
    cat: m[1],
    page: /\bdata-page="([^"]+)"/.exec(m[0])?.[1] ?? null,
    line: m[0],
  }));
}

test('every top-level settings block names a known page in its own category', () => {
  const known = new Set(ALL_PAGE_KEYS);
  for (const b of blocks()) {
    assert.ok(b.page, `no data-page: ${b.line}`);
    assert.ok(known.has(b.page), `unknown page ${b.page}`);
    assert.equal(categoryOf(b.page), b.cat, `page/cat mismatch: ${b.line}`);
  }
});

test('no page is left empty', () => {
  const used = new Set(blocks().map((b) => b.page));
  for (const key of ALL_PAGE_KEYS) assert.ok(used.has(key), `empty page ${key}`);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `pnpm --dir app exec node --test src/lib/settings-nav.template.test.ts`
Expected: FAIL, `no data-page: <section data-cat="basics">`.

- [ ] **Step 3: Move three sections across categories** (change `data-cat`, keep the content)

| Section (heading key) | Line | `data-cat` from → to |
| --- | --- | --- |
| `settings.mindmapControlStyle` | 795 | basics → mindmap |
| `settings.mindmapPasteMapTarget` | 805 | basics → mindmap |
| `settings.appearance` (with slot pickers) | 777 | basics → theme |
| `settings.dailyNotesFolder` | 1856 | advanced → writing |
| `settings.dailyNotesFormat` | 1867 | advanced → writing |
| `settings.importTheme` | 2226 | advanced → theme |

- [ ] **Step 4: Add `data-page` to every top-level block**

Add the attribute next to `data-cat` on each block opening line, using the heading key the block contains:

| `data-page` | Blocks (heading key; `settings.` prefix dropped) |
| --- | --- |
| `basics/language` | language, uiFontSize, globalZoom, showStatusBarViewModes |
| `basics/fonts` | fontFamily, codeFontFamily, fontSize |
| `basics/editor` | wordWrap, lineNumbers, solidCursor, livePreview, alwaysShowMarkers, highlightCurrentLine, limitEditorWidth, codeBlockLineNumbers, foldingEnabled, codeBlockWrap |
| `basics/sidebar` | showOutline, outlineSide, outlineMarker, showFileTree, showBacklinks, showTagsPanel, explorerFullNames, explorerDoubleClickFolders, explorerFollowActive, explorerShowHidden, distinctSplitPanes |
| `basics/preview` | previewFitWidth, previewMaxWidth, markdownHardBreaks, smartQuotes, markdownAutoNumberHeadings, plantumlEnabled, readingByDefaultOnMobile |
| `theme/main` | appearance, themeStudio.pageIntro block, importTheme |
| `writing/aids` | directiveCompletions, spellcheckEnabled, spellCheck, vimMode, slashCommandsEnabled |
| `writing/focus` | writingStats.settingsHeading, focusMode, pomodoro.settingsHeading, typewriterMode |
| `writing/attachments` | attachmentMode, assetsDirName, attachmentCustomPath |
| `writing/image-upload` | imageUploaderSection, imageUploadOnPaste, imageUploadKeepLocal, picgoEndpoint, imageUploadCommand, smmsToken, every s3* block, every ghImage* block |
| `writing/inbox` | inbox.workflowSetting, dailyNotesFolder, dailyNotesFormat |
| `mindmap/main` | mindmap.settingsDefaults, mindmapControlStyle, mindmapPasteMapTarget |
| `sync/main`, `integrations/main`, `export/main`, `keys/main` | every block of that category |
| `advanced/startup` | restoreSession, startupViewMode, perWorkspaceTabs |
| `advanced/files` | autoSaveAfterDelay, autoSaveOnBlur, autoReloadExternalChanges, convertConflict, openFileInNewWindow, revealInFileTreeOnOpen, openLinkedFilesExternally, fileAssoc |
| `advanced/updates` | autoCheckUpdate (with the manual check button), telemetry, aiWarningAlwaysMinimized |

Example: `<section data-cat="basics">` holding `settings.fontFamily` becomes `<section data-cat="basics" data-page="basics/fonts">`.

- [ ] **Step 5: Run the guard and confirm it passes**

Run: `pnpm --dir app exec node --test src/lib/settings-nav.template.test.ts`
Expected: 2/2 PASS. Fix any block the messages name.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/settings-nav.template.test.ts app/src/components/SettingsPanel.vue
git commit -m "feat(settings): tag every settings block with its page"
```

---

### Task 5: SettingsPanel tree nav, breadcrumb, fixed size, Appearance page

**Files:**
- Modify: `app/src/components/SettingsPanel.vue`, `app/src/i18n/en.ts`

**Interfaces:**
- Consumes: everything from Task 3; `tabs.openThemeStudio()` and `themeStudio.openInTab` (Task 2).

- [ ] **Step 1: Replace category state with page state** (lines 91-101 and 217-227)

Delete the local `type SettingsCategory`, the `categories` array, and `activeCategory`. Add:

```ts
import { SETTINGS_NAV, ALL_PAGE_KEYS, categoryOf, crumbsOf, defaultPage, isMultiPage, pageVisibilityCss, parsePageKey, type PageKey, type SettingsCategory } from '../lib/settings-nav';

const activePage = ref<PageKey>(defaultPage('basics'));
const activeCategory = computed<SettingsCategory>(() => categoryOf(activePage.value));
const bodyEl = ref<HTMLElement | null>(null);
watch(activePage, () => {
  bodyEl.value?.scrollTo({ top: 0 });
});
```

`activePage` lives on the always-mounted panel instance, so the last page survives close and reopen for the rest of the app session (D7).

- [ ] **Step 2: Deep links take a page key** (lines 273-285)

```ts
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    const target = parsePageKey(props.initialSection);
    if (target) activePage.value = target;
  },
);
```

This fixes the `keys` deep-link bug, because `parsePageKey('keys')` resolves.

- [ ] **Step 3: Remove the embedded Studio and the widening** (lines 306-312, 597-599, 705-706, 1190-1193)

Delete `themeStudioOpen`, `themePageShown`, the `watch(themePageShown…)`, `THEME_PAGE_WIDTH`, `DEFAULT_WIDTH` and `modalWidth`. Keep `const { isDirty: themeDraftDirty } = useThemeStudio();`. Add:

```ts
const MODAL_WIDTH = 'min(960px, 92vw)';
```

Template: change `:width="modalWidth"` to `:width="MODAL_WIDTH"`. Remove the `:class` on `.settings__frame` and the `#settings-theme-preview` div. Delete the `ThemeStudio` import and the `<ThemeStudio v-if="themePageShown" />` line. In the `theme/main` intro block, replace it with:

```vue
          <button type="button" class="hint-btn" @click="openThemeStudio">🎨 {{ t('themeStudio.openInTab') }}</button>
```

Replace `openThemeStudio`:

```ts
function openThemeStudio() {
  tabs.openThemeStudio();
  emit('close');
}
```

Remove the duplicate `🎨 {{ t('themeStudio.open') }}` button from the appearance section (it now sits on the same page).

- [ ] **Step 4: Generated page visibility**

Replace the CSS show-list (lines 2457-2478) with:

```css
.settings__body[data-active-page] > [data-cat] {
  display: none;
}
```

In the script, after `bodyEl`:

```ts
const PAGE_STYLE_ID = 'settings-page-visibility';
watchEffect(() => {
  const css = pageVisibilityCss(searching.value ? null : activePage.value);
  let el = document.getElementById(PAGE_STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = PAGE_STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
});
onUnmounted(() => document.getElementById(PAGE_STYLE_ID)?.remove());
```

The body binding becomes `:data-active-page="searching ? undefined : activePage"`, replacing `data-active-cat`.

- [ ] **Step 5: Tree nav**

Replace the `<nav class="settings__nav">` contents:

```vue
        <nav class="settings__nav">
          <template v-for="c in SETTINGS_NAV" :key="c.id">
            <button
              class="settings__nav-item"
              :class="{ 'settings__nav-item--active': !searching && activeCategory === c.id }"
              :aria-expanded="isMultiPage(c.id) ? activeCategory === c.id : undefined"
              @click="openPage(defaultPage(c.id))"
            >
              <span class="settings__nav-icon">{{ c.icon }}</span>
              <span class="settings__nav-label">{{ t(c.labelKey) }}</span>
              <span v-if="c.id === 'theme' && themeDraftDirty" class="settings__nav-dot" :title="t('themeStudio.unsaved')">●</span>
            </button>
            <template v-if="isMultiPage(c.id) && activeCategory === c.id && !searching">
              <button
                v-for="p in c.pages"
                :key="p.id"
                class="settings__nav-item settings__nav-sub"
                :class="{ 'settings__nav-item--active': activePage === `${c.id}/${p.id}` }"
                @click="openPage(`${c.id}/${p.id}`)"
              >{{ t(p.labelKey) }}</button>
            </template>
          </template>
        </nav>
```

Replace `pickCategory` (line 423) with:

```ts
function openPage(key: PageKey) {
  searchQuery.value = '';
  activePage.value = key;
}
```

CSS, next to `.settings__nav-item`:

```css
.settings__nav-sub {
  padding-inline-start: 34px;
  font-size: 12px;
  color: var(--text-muted);
}
```

- [ ] **Step 6: Breadcrumb header, and search grouped by page**

As the first child of `.settings__body`, inside `<template v-if="!searching">`:

```vue
          <h2 class="settings__crumb">
            {{ t(crumbsOf(activePage).categoryLabelKey) }}<template v-if="crumbsOf(activePage).pageLabelKey"> › {{ t(crumbsOf(activePage).pageLabelKey!) }}</template>
          </h2>
```

Search: replace `catsWithHits` and `catOrder` with page-level ones:

```ts
const pagesWithHits = ref<Set<string>>(new Set());
const pageOrder = new Map(ALL_PAGE_KEYS.map((k, i) => [k, i]));
```

In `applySearch`, read `const page = b.dataset.page!;`. Set `b.style.order = String((pageOrder.get(page) ?? 999) * 2 + 1);`, add `page` (not `cat`) to the hit set, and assign `pagesWithHits.value`. Clearing resets `pagesWithHits.value = new Set()`.

Replace the search `<h2 v-for="(c, i) in categories" …>` with:

```vue
          <button
            v-for="(key, i) in ALL_PAGE_KEYS"
            v-show="pagesWithHits.has(key)"
            :key="'sg-' + key"
            type="button"
            class="settings__search-group"
            :style="{ order: i * 2 }"
            @click="openPage(key)"
          >{{ t(crumbsOf(key).categoryLabelKey) }}<template v-if="crumbsOf(key).pageLabelKey"> › {{ t(crumbsOf(key).pageLabelKey!) }}</template> ›</button>
```

CSS: give `.settings__search-group` `background: none; border: 0; border-bottom: 1px solid var(--border); text-align: start; cursor: pointer;`. Add `.settings__crumb { font-size: 14px; font-weight: 600; margin: 0 0 4px; color: var(--text); }`.

- [ ] **Step 7: Fixed height**

In `.settings__layout`, change `height: min(560px, 78vh);` to `height: min(640px, 72vh);`. Delete the `.settings__frame--theme` and `.settings__preview` rules.

- [ ] **Step 8: Labels** in `app/src/i18n/en.ts`, under `settings`

```ts
    catBasics: 'General',
    pageLanguage: 'Language & zoom',
    pageFonts: 'Fonts',
    pageEditor: 'Editor display',
    pageSidebar: 'Sidebar & outline',
    pagePreview: 'Preview & Markdown',
    pageAids: 'Editing aids',
    pageFocus: 'Focus',
    pageAttachments: 'Attachments',
    pageImageUpload: 'Image upload',
    pageInbox: 'Inbox & daily notes',
    pageStartup: 'Startup & session',
    pageFiles: 'Files & saving',
    pageUpdates: 'Updates & privacy',
```

Update `themeStudio.pageIntro` to: `'Pick light and dark themes here. To build your own, open Theme Studio in a tab, where the whole app previews your colours live.'`

- [ ] **Step 9: Tests, types, build**

Run: `pnpm --dir app test && pnpm --dir app build`
Expected: all pass. `grep -n "activeCategory.value =\|categories\b\|themePageShown" app/src/components/SettingsPanel.vue` returns nothing.

- [ ] **Step 10: Commit**

```bash
git add app/src/components/SettingsPanel.vue app/src/i18n/en.ts
git commit -m "feat(settings): fixed-size modal with two-level nav and Appearance page"
```

---

### Task 6: Verify in the app, bump the version

**Files:**
- Modify: version files (same set as commit `56a37447`: `git show --stat 56a37447`), `CHANGELOG.md`

- [ ] **Step 1: Browser check** (preview server `solomd-web`, port 1420)

Confirm each item from the spec's Acceptance list:
1. Open Settings, then click through every category and page. The modal width stays at 960px (`getBoundingClientRect().width`).
2. Appearance → "Customize in Theme Studio" closes Settings and opens one tab. A second click focuses the same tab.
3. Change a colour: the tab shows ●. Closing it asks Save/Discard/Cancel. After a reload the tab is not restored.
4. Search "s3": the hit header reads "Writing › Image upload ›", and clicking it opens that page.
5. `window.dispatchEvent(new CustomEvent('solomd:open-settings', { detail: { section: 'keys' } }))` lands on Keys.
6. Check RTL: switch the UI to Hebrew content direction and screenshot the nav and the Studio tab.

- [ ] **Step 2: Bump the minor version** (4.39.x → 4.40.0) in the files `56a37447` touched, and add a CHANGELOG entry:

```markdown
## 4.40.0
- Theme Studio opens in its own editor tab; the whole app is the live preview.
- Settings: fixed size, two-level navigation (General, Writing and Advanced split into pages), breadcrumb, search results grouped by page.
- Fix: deep links to the Keys settings page.
```

- [ ] **Step 3: Full run and commit**

Run: `pnpm --dir app test && pnpm --dir app build`

```bash
git add -A app CHANGELOG.md
git commit -m "Bump to version 4.40.0"
```

---

## Follow-ups (not in this plan)

- Merge the two spellcheck toggles (`spellcheckEnabled` and `spellCheck`) once their behaviours are confirmed.
- Translate the new page labels into the other 13 locales.
