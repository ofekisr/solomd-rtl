<script setup lang="ts">
/**
 * Global workspace search — persistent right-sidebar pane (v4.0.2).
 *
 * Earlier versions opened as a modal dialog over the editor. The persistent
 * panel layout — contributed by @beihai23 in PR #50 — keeps results visible
 * while the user clicks through matches, which fits the search-browse-compare
 * workflow common in knowledge-base editing.
 *
 * Mounts when the parent renders the 'search' pane in the rs-pane-host stack;
 * unmounts on close. ⌘⇧F toggles the parent's `searchOpen` ref.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useGlobalSearch, type SearchHit, type SearchOptions } from '../composables/useGlobalSearch';
import { planTotals, useFolderReplace } from '../composables/useFolderReplace';
import { useToastsStore } from '../stores/toasts';
import RegexKeyboard, { type RegexToken } from './RegexKeyboard.vue';
import type { FolderSearchPreset } from '../lib/folder-search';
import { requestMindmapReveal } from '../lib/mindmap-reveal';
import { useFiles } from '../composables/useFiles';
import { useTabsStore } from '../stores/tabs';
import { useTilesStore } from '../stores/tiles';
import { useWorkspaceStore } from '../stores/workspace';
import { useI18n } from '../i18n';

const props = defineProps<{ prefill?: string; preset?: FolderSearchPreset }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const search = useGlobalSearch();
const folderReplace = useFolderReplace();
const toasts = useToastsStore();
const files = useFiles();
const tabs = useTabsStore();
const tiles = useTilesStore();
const workspace = useWorkspaceStore();
const { t } = useI18n();

const query = ref('');
const hits = ref<SearchHit[]>([]);
const loading = ref(false);
const selectedIdx = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);
const error = ref<string | null>(null);
const replaceOpen = ref(false);
const replacement = ref('');
const replacing = ref(false);
const options = ref<SearchOptions>({ regex: false, caseSensitive: false });
const keyboardOpen = ref(false);
const activeField = ref<'find' | 'replace'>('find');
const replaceRef = ref<HTMLInputElement | null>(null);
const rootOverride = ref<string | null>(null);
const root = computed(() => rootOverride.value ?? workspace.currentFolder);
const isScoped = computed(() => !!rootOverride.value && rootOverride.value !== workspace.currentFolder);
const activeFilePath = computed(() => tabs.activeTab?.filePath ?? '');

const SEARCH_DEBOUNCE_MS = 220;
let debounceTimer: number | null = null;

onMounted(async () => {
  if (props.prefill) {
    query.value = props.prefill;
  }
  await nextTick();
  inputRef.value?.focus();
  if (query.value) doSearch();
});

watch(
  () => props.prefill,
  async (v) => {
    if (v && v !== query.value) {
      query.value = v;
      await nextTick();
      inputRef.value?.focus();
    }
  },
);

watch(() => props.preset, (p) => p && applyPreset(p), { immediate: true });

async function applyPreset(p: FolderSearchPreset) {
  rootOverride.value = p.root;
  query.value = p.query;
  options.value = { ...p.options };
  replacement.value = p.replacement;
  replaceOpen.value = p.replaceOpen || p.action === 'replaceAll';
  if (p.action !== 'replaceAll') return;
  await doSearch();
  await replaceIn();
}

watch([query, replacement, replaceOpen, options, rootOverride], () => {
  if (debounceTimer != null) {
    window.clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(doSearch, SEARCH_DEBOUNCE_MS);
}, { deep: true });

function effectiveQuery(): string {
  return options.value.regex ? query.value : query.value.trim();
}

async function doSearch() {
  const q = effectiveQuery();
  if (!q.trim()) {
    hits.value = [];
    error.value = null;
    return;
  }
  loading.value = true;
  try {
    const extras = {
      options: options.value,
      replacement: replaceOpen.value ? replacement.value : undefined,
    };
    const outcome = await search.run(q, root.value ?? undefined, undefined, extras);
    hits.value = outcome.hits;
    error.value = outcome.error;
    selectedIdx.value = 0;
  } finally {
    loading.value = false;
  }
}

const keyboardTarget = computed(() => (replaceOpen.value ? activeField.value : 'find'));

function insertToken(token: RegexToken) {
  const isFind = keyboardTarget.value === 'find';
  const el = isFind ? inputRef.value : replaceRef.value;
  const model = isFind ? query : replacement;
  if (!el) return;
  const start = el.selectionStart ?? model.value.length;
  const end = el.selectionEnd ?? start;
  const selected = model.value.slice(start, end);
  const text = token.wrap && selected ? token.wrap[0] + selected + token.wrap[1] : token.insert;
  model.value = model.value.slice(0, start) + text + model.value.slice(end);
  const caret = start + (token.wrap && !selected ? token.wrap[0].length : text.length);
  if (isFind) options.value = { ...options.value, regex: true };
  nextTick(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}

function toggleOption(key: keyof SearchOptions) {
  options.value = { ...options.value, [key]: !options.value[key] };
}

async function replaceIn(only?: string[]) {
  const scopeRoot = root.value;
  const q = effectiveQuery();
  if (!scopeRoot || !q.trim() || replacing.value) return;
  replacing.value = true;
  try {
    await runReplace({ root: scopeRoot, query: q, replacement: replacement.value, options: options.value, only });
  } catch (e) {
    toasts.error(t('searchReplace.failed', { error: String(e) }));
  } finally {
    replacing.value = false;
    await doSearch();
  }
}

async function runReplace(input: Parameters<typeof folderReplace.plan>[0]) {
  const plan = await folderReplace.plan(input);
  const totals = planTotals(plan);
  if (!totals.replacements) {
    toasts.info(t('searchReplace.nothing'));
    return;
  }
  const params = { n: totals.replacements, files: totals.files };
  if (!window.confirm(t('searchReplace.confirm', params))) return;
  const result = await folderReplace.apply(plan);
  for (const err of result.errors) toasts.error(err);
  toasts.success(t('searchReplace.done', { n: result.replacements, files: result.files }));
}

const grouped = computed(() => {
  const map = new Map<string, SearchHit[]>();
  for (const h of hits.value) {
    if (!map.has(h.file)) map.set(h.file, []);
    map.get(h.file)!.push(h);
  }
  return Array.from(map.entries());
});

function shortPath(p: string) {
  const folder = root.value;
  if (folder && p.startsWith(folder)) {
    return p.slice(folder.length).replace(/^[\\/]/, '');
  }
  return p.split(/[\\/]/).slice(-2).join('/');
}

async function openHit(hit: SearchHit) {
  try {
    await files.openPath(hit.file);
    if (hit.nodeId) {
      requestMindmapReveal(hit.file, hit.nodeId);
      return;
    }
    nextTick(() => {
      window.dispatchEvent(
        new CustomEvent('solomd:outline-goto', {
          detail: { line: hit.line, paneId: tiles.focusedPaneId },
        }),
      );
    });
  } catch (e) {
    console.error('GlobalSearch: openPath failed', e);
  }
}

function highlight(hit: SearchHit): string {
  let html = '';
  let cursor = 0;
  for (const [start, end] of hit.ranges ?? []) {
    html += escapeHtml(hit.snippet.slice(cursor, start));
    html += `<mark>${escapeHtml(hit.snippet.slice(start, end))}</mark>`;
    cursor = end;
  }
  return html + escapeHtml(hit.snippet.slice(cursor));
}

function escapeHtml(s: string) {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c),
  );
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('close');
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIdx.value = Math.min(selectedIdx.value + 1, hits.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIdx.value = Math.max(selectedIdx.value - 1, 0);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const hit = hits.value[selectedIdx.value];
    if (hit) openHit(hit);
  }
}
</script>

<template>
  <div class="sp">
    <header class="sp__head">
      <span class="sp__title">{{ t('search.heading') }}</span>
      <button
        class="rs-pane-close"
        type="button"
        :title="t('rightSidebar.hidePane')"
        @click="emit('close')"
      >×</button>
    </header>
    <div class="sp__input-wrap">
      <button
        class="sp__chevron"
        type="button"
        :class="{ 'sp__chevron--open': replaceOpen }"
        :title="t('searchReplace.toggle')"
        :aria-expanded="replaceOpen"
        @click="replaceOpen = !replaceOpen"
      >›</button>
      <input
        ref="inputRef"
        v-model="query"
        class="sp__input"
        :placeholder="t('search.placeholder')"
        spellcheck="false"
        @focus="activeField = 'find'"
        @keydown="onKey"
      />
      <span v-if="loading" class="sp__loading">…</span>
      <button
        class="sp__opt"
        type="button"
        :class="{ 'sp__opt--on': options.caseSensitive }"
        :title="t('searchReplace.caseSensitive')"
        :aria-pressed="options.caseSensitive"
        @click="toggleOption('caseSensitive')"
      >Aa</button>
      <button
        class="sp__opt"
        type="button"
        :class="{ 'sp__opt--on': options.regex }"
        :title="t('searchReplace.regex')"
        :aria-pressed="options.regex"
        @click="toggleOption('regex')"
      >.*</button>
      <button
        class="sp__opt"
        type="button"
        data-opt="skip-code"
        :class="{ 'sp__opt--on': options.skipCode }"
        :title="t('findBar.skipCode')"
        :aria-pressed="!!options.skipCode"
        @click="toggleOption('skipCode')"
      >{ }</button>
      <button
        class="sp__opt"
        type="button"
        :class="{ 'sp__opt--on': keyboardOpen }"
        :title="t('searchReplace.keyboard')"
        :aria-pressed="keyboardOpen"
        @click="keyboardOpen = !keyboardOpen"
      >⌨</button>
    </div>
    <div v-if="replaceOpen" class="sp__input-wrap sp__replace-wrap">
      <input
        ref="replaceRef"
        v-model="replacement"
        class="sp__input"
        :placeholder="t('searchReplace.placeholder')"
        spellcheck="false"
        @focus="activeField = 'replace'"
        @keydown.enter.prevent="replaceIn()"
        @keydown.esc.prevent="emit('close')"
      />
      <button
        class="sp__action"
        type="button"
        :disabled="!hits.length || replacing"
        :title="t('searchReplace.replaceAll')"
        @click="replaceIn()"
      >{{ t('searchReplace.replaceAll') }}</button>
    </div>
    <RegexKeyboard
      v-if="keyboardOpen"
      :target="keyboardTarget"
      @insert="insertToken"
    />
    <div v-if="isScoped" class="sp__scope">
      <span class="sp__scope-label" :title="rootOverride ?? ''">{{ t('searchReplace.scopedTo', { folder: rootOverride ?? '' }) }}</span>
      <button class="sp__scope-clear" type="button" :title="t('searchReplace.clearScope')" @click="rootOverride = null">×</button>
    </div>
    <div v-if="!root" class="sp__empty">
      {{ t('search.openFolder') }}
    </div>
    <div v-else-if="!query.trim()" class="sp__empty">
      {{ t('search.typeToSearch') }}
    </div>
    <div v-else-if="error" class="sp__empty sp__error">{{ error }}</div>
    <div v-else-if="!hits.length && !loading" class="sp__empty">
      {{ t('search.noMatches') }}
    </div>
    <div v-else class="sp__results">
      <div v-for="[file, fileHits] in grouped" :key="file" class="sp__group">
        <div
          class="sp__file"
          :class="{ 'sp__file--active': file === activeFilePath }"
        >
          <span class="sp__file-name">{{ shortPath(file) }}</span>
          <button
            v-if="replaceOpen"
            class="sp__file-replace"
            type="button"
            :disabled="replacing"
            :title="t('searchReplace.replaceFile')"
            @click.stop="replaceIn([file])"
          >⇄</button>
        </div>
        <div
          v-for="(hit, i) in fileHits"
          :key="i"
          class="sp__hit"
          :class="{ 'sp__hit--active': hits.indexOf(hit) === selectedIdx }"
          @click="openHit(hit)"
          @mouseenter="selectedIdx = hits.indexOf(hit)"
        >
          <span class="sp__lineno">{{ hit.field ?? `L${hit.line}` }}</span>
          <span class="sp__lines">
            <span
              class="sp__snippet"
              :class="{ 'sp__snippet--replacing': replaceOpen }"
              v-html="highlight(hit)"
            ></span>
            <span v-if="replaceOpen && hit.preview != null" class="sp__preview">{{ hit.preview }}</span>
          </span>
        </div>
      </div>
    </div>
    <div class="sp__footer">
      <span>{{ t('search.hitCount', { n: hits.length }) }}</span>
      <span>{{ t('search.keyHint') }}</span>
    </div>
  </div>
</template>

<style scoped src="./GlobalSearch.css"></style>
