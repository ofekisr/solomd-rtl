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
          v-for="hit in fileHits"
          :key="hit.line"
          class="sp__hit"
          :class="{ 'sp__hit--active': hits.indexOf(hit) === selectedIdx }"
          @click="openHit(hit)"
          @mouseenter="selectedIdx = hits.indexOf(hit)"
        >
          <span class="sp__lineno">L{{ hit.line }}</span>
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

<style scoped>
.sp {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg);
  overflow: hidden;
}
.sp__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-soft);
}
.sp__title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.sp__input-wrap {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border);
  padding: 0 12px;
}
.sp__input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 10px 0;
  font: 13px var(--font-ui);
  color: var(--text);
}
.sp__loading {
  color: var(--accent);
  font-size: 14px;
}
.sp__chevron {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 0 6px 0 0;
  transition: transform 0.12s;
}
.sp__chevron--open {
  transform: rotate(90deg);
}
.sp__opt {
  background: none;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  font: 11px var(--font-mono);
  margin-inline-start: 4px;
  padding: 1px 4px;
}
.sp__opt--on {
  border-color: var(--accent);
  color: var(--accent);
}
.sp__replace-wrap {
  gap: 6px;
  padding-inline-start: 26px;
}
.sp__action {
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text);
  cursor: pointer;
  font-size: 11px;
  padding: 3px 8px;
  white-space: nowrap;
}
.sp__action:disabled,
.sp__file-replace:disabled {
  cursor: default;
  opacity: 0.4;
}
.sp__scope {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-muted);
}
.sp__scope-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl;
  text-align: start;
}
.sp__scope-clear {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
}
.sp__error {
  color: var(--danger, #e5534b);
  font-family: var(--font-mono);
  white-space: pre-wrap;
  text-align: start;
}
.sp__empty {
  padding: 24px 16px;
  color: var(--text-faint);
  text-align: center;
  font-size: 12px;
  line-height: 1.6;
}
.sp__results {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.sp__group {
  margin-bottom: 4px;
}
.sp__file {
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sp__file {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sp__file--active {
  position: relative;
}
.sp__file-replace {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  opacity: 0;
}
.sp__file:hover .sp__file-replace {
  opacity: 1;
}
.sp__file--active .sp__file-name::after {
  content: ' ●';
  font-size: 8px;
  vertical-align: middle;
}
.sp__hit {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 12px 5px 20px;
  font-size: 12px;
  cursor: pointer;
  font-family: var(--font-mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: background 0.1s;
}
.sp__hit:hover,
.sp__hit--active {
  background: var(--bg-hover, rgba(255, 159, 64, 0.12));
}
.sp__lineno {
  color: var(--text-faint);
  flex-shrink: 0;
  font-size: 10px;
  width: 32px;
}
.sp__lines {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.sp__snippet,
.sp__preview {
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  unicode-bidi: plaintext;
}
.sp__snippet--replacing :deep(mark) {
  text-decoration: line-through;
  opacity: 0.75;
}
.sp__preview {
  color: var(--success, #3fb950);
}
.sp__snippet :deep(mark) {
  background: var(--accent, #ff9f40);
  color: #fff;
  padding: 0 2px;
  border-radius: 2px;
}
.sp__footer {
  display: flex;
  justify-content: space-between;
  padding: 6px 12px;
  font-size: 10px;
  color: var(--text-faint);
  border-top: 1px solid var(--border);
}
</style>
