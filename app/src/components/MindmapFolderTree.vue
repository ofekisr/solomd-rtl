<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { dialogPort } from '../platform/index.ts';
import { useI18n } from '../i18n';
import { useSettingsStore } from '../stores/settings';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useWorkspaceStore } from '../stores/workspace';
import { MAX_TREE_ENTRIES, folderNameOf, useFolderTreeScan } from '../composables/useFolderTreeScan';
import { MINDMAP_FOLDER_TREE_EVENT } from '../composables/useMindmapConvert';
import { serializeMindmap } from '../lib/mindmap-format';
import { NODE_WARNING_THRESHOLD, countNodes } from '../lib/mindmap-folder';
import {
  applyScope, defaultScopeRules, folderState, isPathIncluded, type ScopeKind, type ScopeRule, type ScopeState,
} from '../lib/mindmap-folder-scope';
import { buildFolderTreeMap, rowRange, visibleRows, type TagRule, type TreeEntry, type TreeRow } from '../lib/mindmap-folder-tree';

const ESCAPE_KEY = 'Escape';
const MINDMAP_LANGUAGE = 'mindmap';
const MMAP_SUFFIX = '.mmap';
const ROOT_PATH = '';
const INDENT_PX = 16;
const BASE_INDENT_PX = 6;
const MAX_TREE_ENTRIES_TEXT = String(MAX_TREE_ENTRIES);

const { t } = useI18n();
const settings = useSettingsStore();
const tabs = useTabsStore();
const toasts = useToastsStore();
const workspace = useWorkspaceStore();
const { listEntries, scanForMap } = useFolderTreeScan();

const isOpen = ref(false);
const rootAbs = ref<string | null>(null);
const children = ref<Map<string, TreeEntry[]>>(new Map());
const expanded = ref<Set<string>>(new Set());
const selected = ref<Set<string>>(new Set());
const anchor = ref<string | null>(null);
const scope = ref<Map<string, ScopeRule>>(defaultScopeRules());
const showHidden = ref(false);
const wrapFiles = ref(true);
const tagRules = ref<TagRule[]>([]);
const isBusy = ref(false);
const isTruncated = ref(false);
const pendingLargeCount = ref<number | null>(null);
const dialogEl = ref<HTMLElement | null>(null);

const rootName = computed(() => (rootAbs.value ? folderNameOf(rootAbs.value) : ''));
const rows = computed(() => (rootAbs.value ? visibleRows(rootName.value, children.value, expanded.value, showHidden.value) : []));
const selectedRows = computed(() => rows.value.filter((row) => selected.value.has(row.relPath)));
const hasSelection = computed(() => selectedRows.value.length > 0);
const canCreate = computed(() => rootAbs.value !== null && !isBusy.value);

function rowState(row: TreeRow): ScopeState {
  if (row.isDir) return folderState(row.relPath, scope.value);
  return isPathIncluded(row.relPath, false, scope.value) ? 'included' : 'excluded';
}

function resetPending(): void {
  pendingLargeCount.value = null;
  isTruncated.value = false;
}

async function loadChildren(relPath: string): Promise<void> {
  if (!rootAbs.value || children.value.has(relPath)) return;
  const entries = await listEntries(rootAbs.value, relPath);
  children.value = new Map(children.value).set(relPath, entries);
}

async function toggleExpand(row: TreeRow): Promise<void> {
  if (!row.isDir) return;
  const next = new Set(expanded.value);
  if (next.has(row.relPath)) {
    next.delete(row.relPath);
    expanded.value = next;
    return;
  }
  try {
    await loadChildren(row.relPath);
    expanded.value = next.add(row.relPath);
  } catch (error) {
    console.error('mindmap folder tree: listing failed', row.relPath, error);
    toasts.error(t('mindmap.folderReadFailed'));
  }
}

function select(row: TreeRow, e: MouseEvent): void {
  if (e.shiftKey && anchor.value !== null) {
    selected.value = new Set(rowRange(rows.value, anchor.value, row.relPath).map((r) => r.relPath));
    return;
  }
  const isAdditive = e.metaKey || e.ctrlKey;
  const next = isAdditive ? new Set(selected.value) : new Set<string>();
  if (isAdditive && next.has(row.relPath)) next.delete(row.relPath);
  else next.add(row.relPath);
  selected.value = next;
  anchor.value = row.relPath;
}

function apply(kind: ScopeKind, isRecursive: boolean): void {
  const targets = selectedRows.value.map((row) => ({ path: row.relPath, isDir: row.isDir }));
  scope.value = applyScope(scope.value, targets, kind, isRecursive);
  resetPending();
}

function addRule(): void {
  tagRules.value = [...tagRules.value, { suffix: '', tag: '' }];
}

function removeRule(index: number): void {
  tagRules.value = tagRules.value.filter((_, i) => i !== index);
  resetPending();
}

async function openRoot(path: string): Promise<void> {
  rootAbs.value = path;
  children.value = new Map();
  expanded.value = new Set();
  selected.value = new Set();
  anchor.value = null;
  scope.value = defaultScopeRules();
  resetPending();
  try {
    await loadChildren(ROOT_PATH);
    expanded.value = new Set([ROOT_PATH]);
  } catch (error) {
    console.error('mindmap folder tree: listing failed', error);
    toasts.error(t('mindmap.folderReadFailed'));
  }
}

async function chooseFolder(): Promise<void> {
  try {
    const picked = await dialogPort.open({ directory: true, multiple: false });
    if (typeof picked === 'string') await openRoot(picked);
  } catch (error) {
    console.error('mindmap folder tree: dialog failed', error);
    toasts.error(t('mindmap.folderReadFailed'));
  }
}

async function onOpen(): Promise<void> {
  isOpen.value = true;
  rootAbs.value = null;
  tagRules.value = settings.mindmapFolderTagRules.map((rule) => ({ ...rule }));
  if (workspace.currentFolder) await openRoot(workspace.currentFolder);
  await nextTick();
  dialogEl.value?.focus();
}

function close(): void {
  isOpen.value = false;
}

async function create(): Promise<void> {
  if (!rootAbs.value) return;
  isBusy.value = true;
  try {
    settings.setMindmapFolderTagRules(tagRules.value);
    const scan = await scanForMap(rootAbs.value, scope.value);
    const map = buildFolderTreeMap(scan.root, {
      scope: scope.value,
      wrapFiles: wrapFiles.value,
      tagRules: settings.mindmapFolderTagRules,
      filesTopic: (count) => t('mindmap.treeFilesNode', { count: String(count) }),
    });
    const count = countNodes(map);
    if ((count > NODE_WARNING_THRESHOLD || scan.truncated) && pendingLargeCount.value === null) {
      pendingLargeCount.value = count;
      isTruncated.value = scan.truncated;
      return;
    }
    const tab = tabs.newTab({ fileName: `${scan.root.name}${MMAP_SUFFIX}`, language: MINDMAP_LANGUAGE });
    tabs.setContent(tab.id, serializeMindmap(map));
    close();
  } catch (error) {
    console.error('mindmap folder tree: build failed', error);
    toasts.error(t('mindmap.folderConvertFailed'));
  } finally {
    isBusy.value = false;
  }
}

function closeOnEscape(e: KeyboardEvent): void {
  if (!isOpen.value || e.key !== ESCAPE_KEY) return;
  e.preventDefault();
  close();
}

onMounted(() => {
  window.addEventListener(MINDMAP_FOLDER_TREE_EVENT, onOpen);
  window.addEventListener('keydown', closeOnEscape, true);
});
onBeforeUnmount(() => {
  window.removeEventListener(MINDMAP_FOLDER_TREE_EVENT, onOpen);
  window.removeEventListener('keydown', closeOnEscape, true);
});
</script>

<template>
  <div v-if="isOpen" class="mft-backdrop" @click.self="close">
    <div ref="dialogEl" class="mft-dialog" role="dialog" aria-modal="true" tabindex="-1" :aria-label="t('mindmap.treeTitle')">
      <h3>{{ t('mindmap.treeTitle') }}</h3>
      <div class="mft-folder">
        <span class="mft-path" dir="auto">{{ rootAbs ?? t('mindmap.folderNone') }}</span>
        <button type="button" @click="chooseFolder">{{ t('mindmap.folderChoose') }}</button>
      </div>
      <div class="mft-section-head">
        <strong>{{ t('mindmap.treeScope') }}</strong>
        <label class="mft-check">
          <input v-model="showHidden" type="checkbox" />
          <span>{{ t('mindmap.treeShowHidden') }}</span>
        </label>
      </div>
      <div class="mft-toolbar">
        <button type="button" :disabled="!hasSelection" @click="apply('include', false)">{{ t('mindmap.treeInclude') }}</button>
        <button type="button" :disabled="!hasSelection" @click="apply('include', true)">{{ t('mindmap.treeIncludeRecursive') }}</button>
        <button type="button" :disabled="!hasSelection" @click="apply('exclude', false)">{{ t('mindmap.treeExclude') }}</button>
        <button type="button" :disabled="!hasSelection" @click="apply('exclude', true)">{{ t('mindmap.treeExcludeRecursive') }}</button>
      </div>
      <ul class="mft-tree" role="tree" :aria-multiselectable="true">
        <li
          v-for="row in rows" :key="row.relPath" role="treeitem"
          :aria-selected="selected.has(row.relPath)" :aria-expanded="row.isDir ? row.isExpanded : undefined"
          :class="['mft-row', `mft-${rowState(row)}`, { 'mft-selected': selected.has(row.relPath), 'mft-hidden': row.isHidden }]"
          :style="{ paddingInlineStart: `${row.depth * INDENT_PX + BASE_INDENT_PX}px` }"
          @click="select(row, $event)" @dblclick="toggleExpand(row)"
        >
          <button
            v-if="row.isDir" type="button" class="mft-chevron"
            :aria-label="t(row.isExpanded ? 'mindmap.treeCollapse' : 'mindmap.treeExpand')"
            @click.stop="toggleExpand(row)"
          >{{ row.isExpanded ? '▾' : '▸' }}</button>
          <span v-else class="mft-chevron-spacer" />
          <span class="mft-icon" aria-hidden="true">{{ row.isDir ? '📁' : '📄' }}</span>
          <span class="mft-name" dir="auto">{{ row.name }}</span>
          <em v-if="rowState(row) === 'partial'" class="mft-partial-label">{{ t('mindmap.treePartial') }}</em>
        </li>
      </ul>
      <p class="mft-note">{{ t('mindmap.treeScopeHint') }}</p>
      <label class="mft-check">
        <input v-model="wrapFiles" type="checkbox" @change="resetPending" />
        <span>{{ t('mindmap.treeWrapFiles') }}</span>
      </label>
      <div class="mft-section-head">
        <strong>{{ t('mindmap.treeTagRules') }}</strong>
        <button type="button" @click="addRule">{{ t('mindmap.treeAddRule') }}</button>
      </div>
      <div class="mft-rules">
        <div v-for="(rule, index) in tagRules" :key="index" class="mft-rule">
          <input v-model="rule.suffix" type="text" dir="auto" :placeholder="t('mindmap.treeSuffix')" :aria-label="t('mindmap.treeSuffix')" @input="resetPending" />
          <span aria-hidden="true">→</span>
          <input v-model="rule.tag" type="text" dir="auto" :placeholder="t('mindmap.treeTag')" :aria-label="t('mindmap.treeTag')" @input="resetPending" />
          <button type="button" :title="t('mindmap.treeRemoveRule')" :aria-label="t('mindmap.treeRemoveRule')" @click="removeRule(index)">✕</button>
        </div>
      </div>
      <p v-if="isTruncated" class="mft-note" role="alert">{{ t('mindmap.treeTruncated', { count: MAX_TREE_ENTRIES_TEXT }) }}</p>
      <p v-if="pendingLargeCount !== null" class="mft-note" role="alert">{{ t('mindmap.folderLarge', { count: String(pendingLargeCount) }) }}</p>
      <footer>
        <button type="button" @click="close">{{ t('mindmap.folderCancel') }}</button>
        <button type="button" class="mft-primary" :disabled="!canCreate" @click="create">{{ t(pendingLargeCount === null ? 'mindmap.treeCreate' : 'mindmap.folderConvertAnyway') }}</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mft-backdrop { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.4); z-index: var(--z-modal); }
.mft-dialog { display: flex; flex-direction: column; gap: 8px; width: min(680px, 92vw); max-height: 88vh; padding: 16px 20px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--bg-elev); color: var(--text); box-shadow: var(--sh-pop); font: 13px var(--font-ui); outline: none; }
.mft-dialog h3 { margin: 0; }
.mft-folder, .mft-section-head, .mft-toolbar { display: flex; gap: 8px; align-items: center; }
.mft-section-head { justify-content: space-between; }
.mft-toolbar { flex-wrap: wrap; gap: 6px; }
.mft-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-faint); }
.mft-check { display: flex; gap: 6px; align-items: center; }
.mft-tree { flex: 1; min-height: 160px; overflow: auto; margin: 0; padding: 4px 0; list-style: none; border: 1px solid var(--border); border-radius: 6px; user-select: none; }
.mft-row { display: flex; gap: 4px; align-items: center; padding-block: 2px; padding-inline-end: 8px; cursor: default; white-space: nowrap; }
.mft-row:hover { background: var(--bg-hover, var(--accent-soft)); }
.mft-selected, .mft-selected:hover { background: var(--accent-soft); outline: 1px solid var(--accent); outline-offset: -1px; }
.mft-included .mft-name { color: var(--success, #4caf50); }
.mft-partial .mft-name { color: var(--success, #4caf50); font-style: italic; }
.mft-excluded .mft-name { color: var(--text-faint); }
.mft-hidden .mft-icon { opacity: 0.5; }
.mft-dialog .mft-chevron { width: 18px; padding: 0; border: none; background: transparent; color: var(--text-faint); font-size: 11px; }
.mft-chevron-spacer { display: inline-block; width: 18px; }
.mft-icon { font-size: 12px; }
.mft-name { overflow: hidden; text-overflow: ellipsis; }
.mft-partial-label { font-size: 0.8em; color: var(--text-faint); }
.mft-rules { display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow: auto; }
.mft-rule { display: flex; gap: 6px; align-items: center; }
.mft-rule input { flex: 1; min-width: 0; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font: inherit; }
.mft-note { margin: 0; color: var(--text-faint); font-size: 0.9em; }
.mft-dialog footer { display: flex; justify-content: flex-end; gap: 8px; }
.mft-dialog button { background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; font: inherit; cursor: pointer; }
.mft-dialog button:disabled { opacity: 0.5; cursor: default; }
.mft-dialog .mft-primary { background: var(--accent-soft); }
</style>
