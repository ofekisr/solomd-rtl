<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { open as openFolderDialog } from '@tauri-apps/plugin-dialog';
import { useI18n } from '../i18n';
import { useSettingsStore } from '../stores/settings';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useWorkspaceStore } from '../stores/workspace';
import { MAX_TREE_ENTRIES, useFolderTreeScan } from '../composables/useFolderTreeScan';
import { MINDMAP_FOLDER_TREE_EVENT } from '../composables/useMindmapConvert';
import { serializeMindmap } from '../lib/mindmap-format';
import { NODE_WARNING_THRESHOLD, countNodes } from '../lib/mindmap-folder';
import {
  buildFolderTreeMap, defaultIncluded, folderRows, setIncluded, type ScannedFolder, type TagRule,
} from '../lib/mindmap-folder-tree';

const ESCAPE_KEY = 'Escape';
const MINDMAP_LANGUAGE = 'mindmap';
const MMAP_SUFFIX = '.mmap';
const INDENT_PX = 16;
const MAX_TREE_ENTRIES_TEXT = String(MAX_TREE_ENTRIES);

const { t } = useI18n();
const settings = useSettingsStore();
const tabs = useTabsStore();
const toasts = useToastsStore();
const workspace = useWorkspaceStore();
const { scanFolderTree } = useFolderTreeScan();

const isOpen = ref(false);
const folder = ref<string | null>(null);
const root = ref<ScannedFolder | null>(null);
const isTruncated = ref(false);
const included = ref<Set<string>>(new Set());
const showHidden = ref(false);
const wrapFiles = ref(true);
const rules = ref<TagRule[]>([]);
const isLoading = ref(false);
const pendingLargeCount = ref<number | null>(null);
const dialogEl = ref<HTMLElement | null>(null);

const rows = computed(() => (root.value ? folderRows(root.value, showHidden.value) : []));
const canCreate = computed(() => root.value !== null && !isLoading.value);

function resetPending(): void {
  pendingLargeCount.value = null;
}

function toggleFolder(relPath: string, isRecursive: boolean, isIncluded = !included.value.has(relPath)): void {
  if (!root.value) return;
  resetPending();
  included.value = setIncluded(root.value, included.value, relPath, isIncluded, isRecursive, showHidden.value);
}

function addRule(): void {
  rules.value = [...rules.value, { suffix: '', tag: '' }];
}

function removeRule(index: number): void {
  rules.value = rules.value.filter((_, i) => i !== index);
  resetPending();
}

async function load(path: string): Promise<void> {
  isLoading.value = true;
  try {
    const result = await scanFolderTree(path);
    root.value = result.root;
    isTruncated.value = result.truncated;
    included.value = defaultIncluded(result.root);
  } catch (error) {
    console.error('mindmap folder tree: scan failed', error);
    toasts.error(t('mindmap.folderReadFailed'));
    root.value = null;
  } finally {
    isLoading.value = false;
  }
}

async function chooseFolder(): Promise<void> {
  try {
    const selected = await openFolderDialog({ directory: true, multiple: false });
    if (typeof selected !== 'string') return;
    folder.value = selected;
    resetPending();
    await load(selected);
  } catch (error) {
    console.error('mindmap folder tree: dialog failed', error);
    toasts.error(t('mindmap.folderReadFailed'));
  }
}

async function onOpen(): Promise<void> {
  isOpen.value = true;
  resetPending();
  root.value = null;
  isTruncated.value = false;
  rules.value = settings.mindmapFolderTagRules.map((rule) => ({ ...rule }));
  folder.value = workspace.currentFolder;
  if (folder.value) await load(folder.value);
  await nextTick();
  dialogEl.value?.focus();
}

function close(): void {
  isOpen.value = false;
}

function create(): void {
  if (!root.value) return;
  try {
    settings.setMindmapFolderTagRules(rules.value);
    const map = buildFolderTreeMap(root.value, {
      included: included.value,
      wrapFiles: wrapFiles.value,
      showHidden: showHidden.value,
      rules: settings.mindmapFolderTagRules,
      filesTopic: (count) => t('mindmap.treeFilesNode', { count: String(count) }),
    });
    const count = countNodes(map);
    if (count > NODE_WARNING_THRESHOLD && pendingLargeCount.value === null) {
      pendingLargeCount.value = count;
      return;
    }
    const tab = tabs.newTab({ fileName: `${root.value.name}${MMAP_SUFFIX}`, language: MINDMAP_LANGUAGE });
    tabs.setContent(tab.id, serializeMindmap(map));
    close();
  } catch (error) {
    console.error('mindmap folder tree: build failed', error);
    toasts.error(t('mindmap.folderConvertFailed'));
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
        <span class="mft-path" dir="auto">{{ folder ?? t('mindmap.folderNone') }}</span>
        <button type="button" @click="chooseFolder">{{ t('mindmap.folderChoose') }}</button>
      </div>
      <div class="mft-options">
        <label class="mft-check">
          <input v-model="showHidden" type="checkbox" @change="resetPending" />
          <span>{{ t('mindmap.treeShowHidden') }}</span>
        </label>
        <label class="mft-check">
          <input v-model="wrapFiles" type="checkbox" @change="resetPending" />
          <span>{{ t('mindmap.treeWrapFiles') }}</span>
        </label>
      </div>
      <div class="mft-section-head">
        <strong>{{ t('mindmap.treeFolders') }}</strong>
        <span class="mft-bulk">
          <button v-if="root" type="button" @click="toggleFolder('', true, true)">{{ t('mindmap.treeAll') }}</button>
          <button v-if="root" type="button" @click="toggleFolder('', true, false)">{{ t('mindmap.treeNone') }}</button>
        </span>
      </div>
      <ul class="mft-list">
        <li v-for="row in rows" :key="row.relPath" :class="{ 'mft-hidden': row.isHidden }" :style="{ paddingInlineStart: `${row.depth * INDENT_PX + 8}px` }">
          <label dir="auto">
            <input type="checkbox" :checked="included.has(row.relPath)" @change="toggleFolder(row.relPath, false)" />
            <span>{{ row.name }}</span>
          </label>
          <span class="mft-row-actions">
            <button type="button" :title="t('mindmap.treeRecursiveInclude')" :aria-label="t('mindmap.treeRecursiveInclude')" @click="toggleFolder(row.relPath, true, true)">⤵︎✓</button>
            <button type="button" :title="t('mindmap.treeRecursiveExclude')" :aria-label="t('mindmap.treeRecursiveExclude')" @click="toggleFolder(row.relPath, true, false)">⤵︎✕</button>
          </span>
        </li>
      </ul>
      <p v-if="isTruncated" class="mft-note">{{ t('mindmap.treeTruncated', { count: MAX_TREE_ENTRIES_TEXT }) }}</p>
      <div class="mft-section-head">
        <strong>{{ t('mindmap.treeTagRules') }}</strong>
        <button type="button" @click="addRule">{{ t('mindmap.treeAddRule') }}</button>
      </div>
      <div class="mft-rules">
        <div v-for="(rule, index) in rules" :key="index" class="mft-rule">
          <input v-model="rule.suffix" type="text" dir="auto" :placeholder="t('mindmap.treeSuffix')" :aria-label="t('mindmap.treeSuffix')" @input="resetPending" />
          <span aria-hidden="true">→</span>
          <input v-model="rule.tag" type="text" dir="auto" :placeholder="t('mindmap.treeTag')" :aria-label="t('mindmap.treeTag')" @input="resetPending" />
          <button type="button" :title="t('mindmap.treeRemoveRule')" :aria-label="t('mindmap.treeRemoveRule')" @click="removeRule(index)">✕</button>
        </div>
      </div>
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
.mft-dialog { display: flex; flex-direction: column; gap: 10px; width: min(640px, 92vw); max-height: 85vh; padding: 16px 20px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--bg-elev); color: var(--text); box-shadow: var(--sh-pop); font: 13px var(--font-ui); outline: none; }
.mft-dialog h3 { margin: 0; }
.mft-folder, .mft-section-head { display: flex; gap: 8px; align-items: center; }
.mft-section-head { justify-content: space-between; }
.mft-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-faint); }
.mft-options { display: flex; flex-direction: column; gap: 4px; }
.mft-check { display: flex; gap: 6px; align-items: center; }
.mft-bulk { display: flex; gap: 6px; }
.mft-list { flex: 1; min-height: 80px; overflow: auto; margin: 0; padding: 0; list-style: none; border: 1px solid var(--border); border-radius: 6px; }
.mft-list li { display: flex; align-items: center; justify-content: space-between; padding-block: 2px; padding-inline-end: 8px; }
.mft-list li:hover { background: var(--accent-soft); }
.mft-list label { display: flex; gap: 8px; align-items: center; min-width: 0; }
.mft-hidden label span { color: var(--text-faint); }
.mft-row-actions { display: flex; gap: 4px; opacity: 0.4; }
.mft-list li:hover .mft-row-actions, .mft-row-actions:focus-within { opacity: 1; }
.mft-dialog .mft-row-actions button { padding: 0 6px; font-size: 0.85em; }
.mft-rules { display: flex; flex-direction: column; gap: 6px; max-height: 160px; overflow: auto; }
.mft-rule { display: flex; gap: 6px; align-items: center; }
.mft-rule input { flex: 1; min-width: 0; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; font: inherit; }
.mft-note { margin: 0; color: var(--text-faint); }
.mft-dialog footer { display: flex; justify-content: flex-end; gap: 8px; }
.mft-dialog button { background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 5px 12px; font: inherit; cursor: pointer; }
.mft-dialog button:disabled { opacity: 0.5; cursor: default; }
.mft-dialog .mft-primary { background: var(--accent-soft); }
</style>
