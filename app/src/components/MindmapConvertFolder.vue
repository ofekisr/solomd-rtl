<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { open as openFolderDialog } from '@tauri-apps/plugin-dialog';
import { useI18n } from '../i18n';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useWorkspaceStore } from '../stores/workspace';
import { MAX_FILES, useMindmapFolderFiles } from '../composables/useMindmapFolderFiles';
import { MINDMAP_CONVERT_FOLDER_EVENT } from '../composables/useMindmapConvert';
import { rootTopicFromFileName, serializeMindmap } from '../lib/mindmap-format';
import {
  MAX_FILE_BYTES, NODE_WARNING_THRESHOLD, buildFolderMap, countNodes, fileTitle, hasEpubSkip,
  matchesSkipKeyword, parseSkipKeywords, type FolderFile, type FolderPick,
} from '../lib/mindmap-folder';

const ESCAPE_KEY = 'Escape';
const MINDMAP_LANGUAGE = 'mindmap';
const MMAP_SUFFIX = '.mmap';
const PATH_SEPARATOR = /[\\/]/;
const FALLBACK_FOLDER_NAME = 'folder';
const BYTES_PER_MB = 1024 * 1024;
const MAX_FILE_MB = String(MAX_FILE_BYTES / BYTES_PER_MB);
const MAX_FILES_TEXT = String(MAX_FILES);

const { t } = useI18n();
const tabs = useTabsStore();
const toasts = useToastsStore();
const workspace = useWorkspaceStore();
const { listMarkdownFiles } = useMindmapFolderFiles();

const isOpen = ref(false);
const folder = ref<string | null>(null);
const picks = ref<FolderPick[]>([]);
const oversized = ref<string[]>([]);
const isTruncated = ref(false);
const checked = ref<Record<string, boolean>>({});
const manuallyToggled = new Set<string>();
const skipInput = ref('');
const groupBySubfolder = ref(false);
const isLoading = ref(false);
const pendingLargeCount = ref<number | null>(null);
const dialogEl = ref<HTMLElement | null>(null);

const skipKeywords = computed(() => parseSkipKeywords(skipInput.value));
const selectedFiles = computed<FolderFile[]>(() => picks.value.filter((p) => checked.value[p.file.relPath]).map((p) => p.file));
const folderName = computed(() => folder.value?.split(PATH_SEPARATOR).filter(Boolean).pop() ?? FALLBACK_FOLDER_NAME);
const canConvert = computed(() => selectedFiles.value.length > 0 && !isLoading.value);

function isDefaultChecked(pick: FolderPick): boolean {
  if (pick.skippedByDirective) return false;
  const stem = rootTopicFromFileName(pick.file.relPath);
  return !matchesSkipKeyword(pick.title, skipKeywords.value) && !matchesSkipKeyword(stem, skipKeywords.value);
}

function applyChecks(): void {
  const next: Record<string, boolean> = {};
  for (const pick of picks.value) {
    const key = pick.file.relPath;
    next[key] = manuallyToggled.has(key) ? checked.value[key] : isDefaultChecked(pick);
  }
  checked.value = next;
}

function onSkipInput(): void {
  pendingLargeCount.value = null;
  applyChecks();
}

function toggle(relPath: string): void {
  pendingLargeCount.value = null;
  manuallyToggled.add(relPath);
  checked.value = { ...checked.value, [relPath]: !checked.value[relPath] };
}

async function load(path: string): Promise<void> {
  isLoading.value = true;
  try {
    const result = await listMarkdownFiles(path);
    picks.value = result.files.map((file) => ({ file, title: fileTitle(file), skippedByDirective: hasEpubSkip(file.text) }));
    oversized.value = result.oversized;
    isTruncated.value = result.truncated;
    manuallyToggled.clear();
    applyChecks();
  } catch (error) {
    console.error('mindmap folder: listing failed', error);
    toasts.error(t('mindmap.folderReadFailed'));
    picks.value = [];
    oversized.value = [];
    isTruncated.value = false;
  } finally {
    isLoading.value = false;
  }
}

async function chooseFolder(): Promise<void> {
  try {
    const selected = await openFolderDialog({ directory: true, multiple: false });
    if (typeof selected !== 'string') return;
    folder.value = selected;
    await load(selected);
  } catch (error) {
    console.error('mindmap folder: dialog failed', error);
    toasts.error(t('mindmap.folderReadFailed'));
  }
}

async function onOpen(): Promise<void> {
  isOpen.value = true;
  pendingLargeCount.value = null;
  picks.value = [];
  oversized.value = [];
  isTruncated.value = false;
  folder.value = workspace.currentFolder;
  if (folder.value) await load(folder.value);
  await nextTick();
  dialogEl.value?.focus();
}

function close(): void {
  isOpen.value = false;
}

function convert(): void {
  try {
    const map = buildFolderMap(folderName.value, selectedFiles.value, {
      groupBySubfolder: groupBySubfolder.value,
      workspaceRoot: workspace.currentFolder,
    });
    const count = countNodes(map);
    if (count > NODE_WARNING_THRESHOLD && pendingLargeCount.value === null) {
      pendingLargeCount.value = count;
      return;
    }
    const tab = tabs.newTab({ fileName: `${folderName.value}${MMAP_SUFFIX}`, language: MINDMAP_LANGUAGE });
    tabs.setContent(tab.id, serializeMindmap(map));
    close();
  } catch (error) {
    console.error('mindmap folder: convert failed', error);
    toasts.error(t('mindmap.folderConvertFailed'));
  }
}

function closeOnEscape(e: KeyboardEvent): void {
  if (!isOpen.value || e.key !== ESCAPE_KEY) return;
  e.preventDefault();
  close();
}

onMounted(() => {
  window.addEventListener(MINDMAP_CONVERT_FOLDER_EVENT, onOpen);
  window.addEventListener('keydown', closeOnEscape, true);
});
onBeforeUnmount(() => {
  window.removeEventListener(MINDMAP_CONVERT_FOLDER_EVENT, onOpen);
  window.removeEventListener('keydown', closeOnEscape, true);
});
</script>

<template>
  <div v-if="isOpen" class="mmf-backdrop" @click.self="close">
    <div ref="dialogEl" class="mmf-dialog" role="dialog" aria-modal="true" tabindex="-1" :aria-label="t('mindmap.folderTitle')">
      <h3>{{ t('mindmap.folderTitle') }}</h3>
      <div class="mmf-folder">
        <span class="mmf-path" dir="auto">{{ folder ?? t('mindmap.folderNone') }}</span>
        <button type="button" @click="chooseFolder">{{ t('mindmap.folderChoose') }}</button>
      </div>
      <label class="mmf-field">
        <span>{{ t('mindmap.folderSkipKeywords') }}</span>
        <input v-model="skipInput" type="text" dir="auto" @input="onSkipInput" />
      </label>
      <label class="mmf-check">
        <input v-model="groupBySubfolder" type="checkbox" @change="pendingLargeCount = null" />
        <span>{{ t('mindmap.folderGroup') }}</span>
      </label>
      <ul class="mmf-list">
        <li v-for="pick in picks" :key="pick.file.relPath" dir="auto">
          <label>
            <input type="checkbox" :checked="checked[pick.file.relPath]" @change="toggle(pick.file.relPath)" />
            <span class="mmf-rel">{{ pick.file.relPath }}</span>
            <span class="mmf-title">{{ pick.title }}</span>
            <em v-if="pick.skippedByDirective" class="mmf-badge">{{ t('mindmap.folderSkippedDirective') }}</em>
          </label>
        </li>
      </ul>
      <p v-if="isTruncated" class="mmf-truncated">{{ t('mindmap.folderTruncated', { count: MAX_FILES_TEXT }) }}</p>
      <p v-if="pendingLargeCount !== null" class="mmf-large" role="alert">{{ t('mindmap.folderLarge', { count: String(pendingLargeCount) }) }}</p>
      <div v-if="oversized.length" class="mmf-oversized">
        <strong>{{ t('mindmap.folderOversized', { size: MAX_FILE_MB }) }}</strong>
        <ul><li v-for="name in oversized" :key="name" dir="auto">{{ name }}</li></ul>
      </div>
      <footer>
        <button type="button" @click="close">{{ t('mindmap.folderCancel') }}</button>
        <button type="button" class="mmf-primary" :disabled="!canConvert" @click="convert">{{ t(pendingLargeCount === null ? 'mindmap.folderConvert' : 'mindmap.folderConvertAnyway') }}</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mmf-backdrop { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.4); z-index: var(--z-modal); }
.mmf-dialog { display: flex; flex-direction: column; gap: 10px; width: min(640px, 92vw); max-height: 80vh; padding: 16px 20px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--bg-elev); color: var(--text); box-shadow: var(--sh-pop); font: 13px var(--font-ui); outline: none; }
.mmf-dialog h3 { margin: 0; }
.mmf-folder { display: flex; gap: 8px; align-items: center; }
.mmf-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-faint); }
.mmf-field { display: flex; flex-direction: column; gap: 4px; }
.mmf-check { display: flex; gap: 6px; align-items: center; }
.mmf-list { flex: 1; min-height: 80px; overflow: auto; margin: 0; padding: 0; list-style: none; border: 1px solid var(--border); border-radius: 6px; }
.mmf-list label { display: flex; gap: 8px; align-items: center; padding: 4px 8px; }
.mmf-rel { color: var(--text-faint); font-size: 0.9em; }
.mmf-badge { font-size: 0.8em; padding: 0 6px; border-radius: 8px; background: var(--accent-soft); }
.mmf-oversized ul { margin: 4px 0 0; padding-inline-start: 18px; }
.mmf-dialog footer { display: flex; justify-content: flex-end; gap: 8px; }
.mmf-field input[type='text'] { background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font: inherit; }
.mmf-dialog button { background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 5px 12px; font: inherit; cursor: pointer; }
.mmf-dialog button:disabled { opacity: 0.5; cursor: default; }
.mmf-dialog .mmf-primary { background: var(--accent-soft); }
.mmf-large { color: var(--text); }
.mmf-truncated { color: var(--text-faint); }
</style>
