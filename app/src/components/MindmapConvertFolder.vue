<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { open as openFolderDialog } from '@tauri-apps/plugin-dialog';
import { useI18n } from '../i18n';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useWorkspaceStore } from '../stores/workspace';
import { useMindmapFolderFiles } from '../composables/useMindmapFolderFiles';
import { MINDMAP_CONVERT_FOLDER_EVENT } from '../composables/useMindmapConvert';
import { serializeMindmap } from '../lib/mindmap-format';
import {
  NODE_WARNING_THRESHOLD, buildFolderMap, countNodes, fileTitle, hasEpubSkip,
  matchesSkipKeyword, parseSkipKeywords, type FolderFile, type FolderPick,
} from '../lib/mindmap-folder';

const ESCAPE_KEY = 'Escape';
const MINDMAP_LANGUAGE = 'mindmap';
const MMAP_SUFFIX = '.mmap';
const PATH_SEPARATOR = /[\\/]/;
const FALLBACK_FOLDER_NAME = 'folder';

const { t } = useI18n();
const tabs = useTabsStore();
const toasts = useToastsStore();
const workspace = useWorkspaceStore();
const { listMarkdownFiles } = useMindmapFolderFiles();

const isOpen = ref(false);
const folder = ref<string | null>(null);
const picks = ref<FolderPick[]>([]);
const oversized = ref<string[]>([]);
const checked = ref<Record<string, boolean>>({});
const manuallyToggled = new Set<string>();
const skipInput = ref('');
const groupBySubfolder = ref(false);
const isLoading = ref(false);
const dialogEl = ref<HTMLElement | null>(null);

const skipKeywords = computed(() => parseSkipKeywords(skipInput.value));
const selectedFiles = computed<FolderFile[]>(() => picks.value.filter((p) => checked.value[p.file.relPath]).map((p) => p.file));
const folderName = computed(() => folder.value?.split(PATH_SEPARATOR).filter(Boolean).pop() ?? FALLBACK_FOLDER_NAME);
const canConvert = computed(() => selectedFiles.value.length > 0 && !isLoading.value);

function isDefaultChecked(pick: FolderPick): boolean {
  if (pick.skippedByDirective) return false;
  const stem = pick.file.relPath.split('/').pop() ?? pick.file.relPath;
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

function toggle(relPath: string): void {
  manuallyToggled.add(relPath);
  checked.value = { ...checked.value, [relPath]: !checked.value[relPath] };
}

async function load(path: string): Promise<void> {
  isLoading.value = true;
  try {
    const result = await listMarkdownFiles(path);
    picks.value = result.files.map((file) => ({ file, title: fileTitle(file), skippedByDirective: hasEpubSkip(file.text) }));
    oversized.value = result.oversized;
    manuallyToggled.clear();
    applyChecks();
  } catch (error) {
    console.error('mindmap folder: listing failed', error);
    toasts.error(t('mindmap.folderReadFailed'));
    picks.value = [];
    oversized.value = [];
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
  picks.value = [];
  oversized.value = [];
  folder.value = workspace.currentFolder;
  if (folder.value) await load(folder.value);
  await nextTick();
  dialogEl.value?.focus();
}

function close(): void {
  isOpen.value = false;
}

function convert(): void {
  const map = buildFolderMap(folderName.value, selectedFiles.value, {
    groupBySubfolder: groupBySubfolder.value,
    workspaceRoot: workspace.currentFolder,
  });
  const count = countNodes(map);
  if (count > NODE_WARNING_THRESHOLD && !window.confirm(t('mindmap.folderLarge', { count: String(count) }))) return;
  const tab = tabs.newTab({ fileName: `${folderName.value}${MMAP_SUFFIX}`, language: MINDMAP_LANGUAGE });
  tabs.setContent(tab.id, serializeMindmap(map));
  close();
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
        <input v-model="skipInput" type="text" dir="auto" @input="applyChecks" />
      </label>
      <label class="mmf-check">
        <input v-model="groupBySubfolder" type="checkbox" />
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
      <div v-if="oversized.length" class="mmf-oversized">
        <strong>{{ t('mindmap.folderOversized') }}</strong>
        <ul><li v-for="name in oversized" :key="name" dir="auto">{{ name }}</li></ul>
      </div>
      <footer>
        <button type="button" @click="close">{{ t('mindmap.folderCancel') }}</button>
        <button type="button" class="mmf-primary" :disabled="!canConvert" @click="convert">{{ t('mindmap.folderConvert') }}</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.mmf-backdrop { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgb(0 0 0 / 0.4); z-index: 1000; }
.mmf-dialog { display: flex; flex-direction: column; gap: 10px; width: min(640px, 92vw); max-height: 80vh; padding: 16px 20px; border-radius: 10px; background: var(--bg-primary, #fff); color: var(--text-primary, inherit); box-shadow: 0 8px 32px rgb(0 0 0 / 0.3); outline: none; }
.mmf-dialog h3 { margin: 0; }
.mmf-folder { display: flex; gap: 8px; align-items: center; }
.mmf-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.8; }
.mmf-field { display: flex; flex-direction: column; gap: 4px; }
.mmf-check { display: flex; gap: 6px; align-items: center; }
.mmf-list { flex: 1; min-height: 80px; overflow: auto; margin: 0; padding: 0; list-style: none; border: 1px solid var(--border-color, rgb(128 128 128 / 0.3)); border-radius: 6px; }
.mmf-list label { display: flex; gap: 8px; align-items: center; padding: 4px 8px; }
.mmf-rel { opacity: 0.7; font-size: 0.9em; }
.mmf-badge { font-size: 0.8em; padding: 0 6px; border-radius: 8px; background: rgb(128 128 128 / 0.2); }
.mmf-oversized ul { margin: 4px 0 0; padding-inline-start: 18px; }
.mmf-dialog footer { display: flex; justify-content: flex-end; gap: 8px; }
</style>
