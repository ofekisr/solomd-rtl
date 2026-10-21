<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';
import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
import { useI18n } from '../i18n';
import { useToastsStore } from '../stores/toasts';
import { useMindmapWorkbenchStore } from '../stores/mindmapWorkbench';
import { fileDraft, MINDMAP_WORKBENCH_EVENT, useMindmapWorkbench, type WorkbenchOpenDetail } from '../composables/useMindmapWorkbench';
import { defaultMergeTopic, type Staleness } from '../lib/mindmap-workbench';

const ESCAPE_KEY = 'Escape';
const MMAP_FILTER = [{ name: 'Mind map', extensions: ['mmap'] }];
const MIN_MERGE = 2;

const { t } = useI18n();
const toasts = useToastsStore();
const store = useMindmapWorkbenchStore();
const { staleness, refreshEntry, mergeSelected } = useMindmapWorkbench();

const isOpen = ref(false);
const isBusy = ref(false);
const status = ref<Record<string, Staleness>>({});
const rootTopic = ref('');
const dialogEl = ref<HTMLElement | null>(null);

const selectedCount = computed(() => store.selectedEntries.length);
const mergeable = computed(() => store.selectedEntries.filter((e) => status.value[e.id] !== 'missing').length);
const canMerge = computed(() => mergeable.value >= MIN_MERGE && !isBusy.value && rootTopic.value.trim() !== '');

async function refreshStatus(): Promise<void> {
  const pairs = await Promise.all(store.entries.map(async (e) => [e.id, await staleness(e)] as const));
  status.value = Object.fromEntries(pairs);
  rootTopic.value = defaultMergeTopic(store.selectedEntries.map((e) => e.label));
}

function announce(result: 'added' | 'updated'): void {
  toasts.success(t(result === 'added' ? 'mindmap.workbenchAdded' : 'mindmap.workbenchUpdated'));
}

async function onOpen(e: Event): Promise<void> {
  const draft = (e as CustomEvent<WorkbenchOpenDetail>).detail?.autoAdd;
  if (draft) announce(store.add(draft));
  isOpen.value = true;
  await refreshStatus();
  await nextTick();
  dialogEl.value?.focus();
}

async function addMaps(): Promise<void> {
  const picked = await openFileDialog({ multiple: true, filters: MMAP_FILTER });
  const paths = Array.isArray(picked) ? picked : picked ? [picked] : [];
  for (const path of paths) store.add(fileDraft(path));
  await refreshStatus();
}

async function removeSelected(): Promise<void> {
  store.removeSelected();
  await refreshStatus();
}

async function refreshSelected(): Promise<void> {
  isBusy.value = true;
  try {
    for (const e of store.selectedEntries) if (e.kind === 'nodes') await refreshEntry(e);
    await refreshStatus();
  } finally {
    isBusy.value = false;
  }
}

async function merge(): Promise<void> {
  isBusy.value = true;
  try {
    if (await mergeSelected(rootTopic.value.trim())) isOpen.value = false;
  } finally {
    isBusy.value = false;
  }
}

function close(): void {
  isOpen.value = false;
}

function closeOnEscape(e: KeyboardEvent): void {
  if (!isOpen.value || e.key !== ESCAPE_KEY) return;
  e.preventDefault();
  close();
}

onMounted(() => {
  window.addEventListener(MINDMAP_WORKBENCH_EVENT, onOpen);
  window.addEventListener('keydown', closeOnEscape, true);
});
onBeforeUnmount(() => {
  window.removeEventListener(MINDMAP_WORKBENCH_EVENT, onOpen);
  window.removeEventListener('keydown', closeOnEscape, true);
});
</script>

<template>
  <div v-if="isOpen" class="mindmap-workbench__overlay" @click.self="close">
    <div ref="dialogEl" class="mindmap-workbench" role="dialog" aria-modal="true" :aria-label="t('mindmap.workbench')" tabindex="-1">
      <h3>{{ t('mindmap.workbench') }}</h3>
      <div class="mindmap-workbench__bar">
        <button type="button" :aria-label="t('mindmap.workbenchSelectAll')" :title="t('mindmap.workbenchSelectAll')" @click="store.setAll(true)">✓</button>
        <button type="button" :aria-label="t('mindmap.workbenchSelectNone')" :title="t('mindmap.workbenchSelectNone')" @click="store.setAll(false)">✗</button>
        <span>{{ t('mindmap.workbenchSelectedCount', { selected: String(selectedCount), total: String(store.entries.length) }) }}</span>
      </div>
      <p v-if="store.entries.length === 0" class="mindmap-workbench__empty">{{ t('mindmap.workbenchEmpty') }}</p>
      <ul v-else class="mindmap-workbench__list">
        <li v-for="e in store.entries" :key="e.id" dir="auto">
          <label>
            <input type="checkbox" :checked="e.selected" @change="store.toggle(e.id)" />
            <span>{{ e.kind === 'file' ? '🗺' : '🌿' }} {{ e.label }}</span>
            <em v-if="status[e.id] === 'missing'" class="mindmap-workbench__badge">{{ t('mindmap.workbenchMissing') }}</em>
            <em v-else-if="status[e.id] === 'stale'" class="mindmap-workbench__badge">{{ t('mindmap.workbenchStale') }}</em>
          </label>
        </li>
      </ul>
      <label class="mindmap-workbench__topic">
        <span>{{ t('mindmap.workbenchRootTopic') }}</span>
        <input v-model="rootTopic" type="text" dir="auto" />
      </label>
      <div class="mindmap-workbench__actions">
        <button type="button" @click="addMaps">{{ t('mindmap.workbenchAddMap') }}</button>
        <button type="button" :disabled="selectedCount === 0" @click="removeSelected">{{ t('mindmap.workbenchRemoveSelected') }}</button>
        <button type="button" :disabled="selectedCount === 0 || isBusy" @click="refreshSelected">{{ t('mindmap.workbenchRefreshSelected') }}</button>
        <button type="button" class="mindmap-workbench__primary" :disabled="!canMerge" :title="canMerge ? '' : t('mindmap.workbenchMergeNeedsTwo')" @click="merge">{{ t('mindmap.workbenchMergeSelected') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mindmap-workbench__overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, 0.4); z-index: var(--z-modal); }
.mindmap-workbench { display: flex; flex-direction: column; gap: 10px; width: min(560px, 92vw); max-height: 80vh; padding: 16px 20px; border: 1px solid var(--border); border-radius: var(--r-lg); background: var(--bg-elev); color: var(--text); box-shadow: var(--sh-pop); font: 13px var(--font-ui); outline: none; }
.mindmap-workbench h3 { margin: 0; }
.mindmap-workbench__bar { display: flex; gap: 8px; align-items: center; color: var(--text-faint); }
.mindmap-workbench__empty { margin: 0; color: var(--text-faint); }
.mindmap-workbench__list { flex: 1; min-height: 80px; overflow: auto; margin: 0; padding: 0; list-style: none; border: 1px solid var(--border); border-radius: 6px; }
.mindmap-workbench__list label { display: flex; gap: 8px; align-items: center; padding: 4px 8px; }
.mindmap-workbench__badge { font-size: 0.8em; padding: 0 6px; border-radius: 8px; background: var(--accent-soft); }
.mindmap-workbench__topic { display: flex; flex-direction: column; gap: 4px; }
.mindmap-workbench__topic input { background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 6px 8px; font: inherit; }
.mindmap-workbench__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.mindmap-workbench button { background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 5px 12px; font: inherit; cursor: pointer; }
.mindmap-workbench button:disabled { opacity: 0.5; cursor: default; }
.mindmap-workbench .mindmap-workbench__primary { background: var(--accent-soft); }
</style>
