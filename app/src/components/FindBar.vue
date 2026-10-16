<script setup lang="ts">
/**
 * IDE-style find / replace bar. It drives a `FindTarget`: CodeMirror in a text
 * tab (`lib/cm-find-panel.ts`) or the canvas in a mind-map tab
 * (`lib/mindmap-find.ts`). Scopes "folder" (the open file's directory) and
 * "all" (the workspace) stream the same query live to the Search-in-Folder
 * pane, which lists the hits.
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import RegexKeyboard, { type RegexToken } from './RegexKeyboard.vue';
import { useWorkspaceStore } from '../stores/workspace';
import { useI18n } from '../i18n';
import { parentDir, requestFolderSearch, type FindScope } from '../lib/folder-search';
import type { FindSpec, FindTarget } from '../lib/find-spec';

const props = defineProps<{
  target: FindTarget;
  external: FindSpec;
  tick: number;
  getFilePath: () => string | undefined;
}>();

const workspace = useWorkspaceStore();
const { t } = useI18n();

const FOLDER_SYNC_DEBOUNCE_MS = 200;
const NAMED_GROUP_TOKENS = ['$<n>'];

const query = ref(props.external.search);
const replacement = ref(props.external.replace);
const caseSensitive = ref(props.external.caseSensitive);
const regex = ref(props.external.regexp);
const replaceOpen = ref(!!props.external.replace);
const keyboardOpen = ref(false);
const scope = ref<FindScope>('file');
const activeField = ref<'find' | 'replace'>('find');
const findRef = ref<HTMLInputElement | null>(null);
const replaceRef = ref<HTMLInputElement | null>(null);
let syncTimer: number | null = null;

const filePath = computed(() => props.getFilePath());
const folderRoot = computed(() => (filePath.value ? parentDir(filePath.value) : null));
const scopeRoot = computed(() => {
  if (scope.value === 'folder') return folderRoot.value;
  if (scope.value === 'all') return workspace.currentFolder;
  return null;
});
const isFileScope = computed(() => scope.value === 'file');
const keyboardTarget = computed(() => (replaceOpen.value ? activeField.value : 'find'));
const hiddenTokens = computed(() =>
  isFileScope.value && !props.target.supportsNamedGroups ? NAMED_GROUP_TOKENS : [],
);

const spec = computed<FindSpec>(() => ({
  search: query.value,
  replace: replacement.value,
  caseSensitive: caseSensitive.value,
  regexp: regex.value,
}));

const counter = computed(() => {
  void props.tick;
  return props.target.counter(spec.value);
});

const counterLabel = computed(() => {
  const { index, total } = counter.value;
  if (!total) return t('findBar.none');
  if (!index) return t('findBar.matches', { n: total });
  return t('findBar.count', { i: index, n: total });
});

const isInvalid = computed(() => !!query.value && !props.target.isValid(spec.value));

watch(spec, (s) => {
  props.target.setSpec(s);
  scheduleFolderSync();
}, { immediate: true });

watch(scope, () => scheduleFolderSync(0));

watch(() => props.external, (s) => {
  query.value = s.search;
  replacement.value = s.replace;
  caseSensitive.value = s.caseSensitive;
  regex.value = s.regexp;
});

function scheduleFolderSync(delay = FOLDER_SYNC_DEBOUNCE_MS) {
  if (syncTimer != null) window.clearTimeout(syncTimer);
  if (isFileScope.value) return;
  syncTimer = window.setTimeout(() => sendToFolderPane(), delay);
}

function sendToFolderPane(action?: 'replaceAll') {
  const root = scopeRoot.value;
  if (!root || !query.value) return;
  requestFolderSearch({
    root,
    query: query.value,
    options: { regex: regex.value, caseSensitive: caseSensitive.value },
    replacement: replacement.value,
    replaceOpen: replaceOpen.value,
    action,
  });
}

function next() {
  if (isFileScope.value) props.target.next();
  else sendToFolderPane();
}

function prev() {
  props.target.prev();
}

function replaceOne() {
  props.target.replaceOne();
}

function replaceEverything() {
  if (isFileScope.value) props.target.replaceAll();
  else sendToFolderPane('replaceAll');
}

function close() {
  props.target.close();
}

function onFindKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey && isFileScope.value) prev();
    else next();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
}

function onReplaceKey(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.metaKey || e.ctrlKey || !isFileScope.value) replaceEverything();
    else replaceOne();
  } else if (e.key === 'Escape') {
    e.preventDefault();
    close();
  }
}

function insertToken(token: RegexToken) {
  const isFind = keyboardTarget.value === 'find';
  const el = isFind ? findRef.value : replaceRef.value;
  const model = isFind ? query : replacement;
  if (!el) return;
  const start = el.selectionStart ?? model.value.length;
  const end = el.selectionEnd ?? start;
  const selected = model.value.slice(start, end);
  const text = token.wrap && selected ? token.wrap[0] + selected + token.wrap[1] : token.insert;
  model.value = model.value.slice(0, start) + text + model.value.slice(end);
  const caret = start + (token.wrap && !selected ? token.wrap[0].length : text.length);
  if (isFind) regex.value = true;
  nextTick(() => {
    el.focus();
    el.setSelectionRange(caret, caret);
  });
}

function shortRoot(root: string | null): string {
  if (!root) return '';
  return root.split(/[\\/]/).filter(Boolean).pop() ?? root;
}

function focus() {
  findRef.value?.focus();
  findRef.value?.select();
}

onMounted(focus);
defineExpose({ focus });
</script>

<template>
  <div class="fb">
    <div class="fb__row">
      <button
        class="fb__chevron"
        type="button"
        :class="{ 'fb__chevron--open': replaceOpen }"
        :title="t('searchReplace.toggle')"
        :aria-expanded="replaceOpen"
        @click="replaceOpen = !replaceOpen"
      >›</button>
      <div class="fb__field" :class="{ 'fb__field--invalid': isInvalid }">
        <input
          ref="findRef"
          v-model="query"
          main-field="true"
          class="fb__input"
          :placeholder="t('findBar.find')"
          :aria-label="t('findBar.find')"
          spellcheck="false"
          @focus="activeField = 'find'"
          @keydown="onFindKey"
        />
        <button
          class="fb__opt"
          type="button"
          :class="{ 'fb__opt--on': caseSensitive }"
          :title="t('searchReplace.caseSensitive')"
          :aria-pressed="caseSensitive"
          @click="caseSensitive = !caseSensitive"
        >Aa</button>
        <button
          class="fb__opt"
          type="button"
          :class="{ 'fb__opt--on': regex }"
          :title="t('searchReplace.regex')"
          :aria-pressed="regex"
          @click="regex = !regex"
        >.*</button>
        <button
          class="fb__opt"
          type="button"
          :class="{ 'fb__opt--on': keyboardOpen }"
          :title="t('searchReplace.keyboard')"
          :aria-pressed="keyboardOpen"
          @click="keyboardOpen = !keyboardOpen"
        >⌨</button>
      </div>
      <span v-if="isFileScope" class="fb__count">
        {{ counterLabel }}
      </span>
      <template v-if="isFileScope">
        <button class="fb__btn" type="button" :title="t('findBar.prev')" @click="prev">↑</button>
        <button class="fb__btn" type="button" :title="t('findBar.next')" @click="next">↓</button>
      </template>
      <div class="fb__scope" role="radiogroup" :aria-label="t('findBar.scope')">
        <button
          type="button"
          role="radio"
          class="fb__scope-btn"
          :class="{ 'fb__scope-btn--on': scope === 'file' }"
          :aria-checked="scope === 'file'"
          :title="t('findBar.scopeFileHint')"
          @click="scope = 'file'"
        >{{ t('findBar.scopeFile') }}</button>
        <button
          type="button"
          role="radio"
          class="fb__scope-btn"
          :class="{ 'fb__scope-btn--on': scope === 'folder' }"
          :aria-checked="scope === 'folder'"
          :disabled="!folderRoot"
          :title="folderRoot ?? t('findBar.scopeFolderHint')"
          @click="scope = 'folder'"
        >{{ t('findBar.scopeFolder') }}</button>
        <button
          type="button"
          role="radio"
          class="fb__scope-btn"
          :class="{ 'fb__scope-btn--on': scope === 'all' }"
          :aria-checked="scope === 'all'"
          :disabled="!workspace.currentFolder"
          :title="workspace.currentFolder ?? t('findBar.scopeAllHint')"
          @click="scope = 'all'"
        >{{ t('findBar.scopeAll') }}</button>
      </div>
      <button class="fb__btn" type="button" :title="t('findBar.close')" @click="close">×</button>
    </div>
    <div v-if="replaceOpen" class="fb__row fb__row--replace">
      <div class="fb__field">
        <input
          ref="replaceRef"
          v-model="replacement"
          class="fb__input"
          :placeholder="t('findBar.replace')"
          :aria-label="t('findBar.replace')"
          spellcheck="false"
          @focus="activeField = 'replace'"
          @keydown="onReplaceKey"
        />
      </div>
      <button v-if="isFileScope" class="fb__btn fb__btn--text" type="button" @click="replaceOne">
        {{ t('findBar.replaceOne') }}
      </button>
      <button class="fb__btn fb__btn--text" type="button" @click="replaceEverything">
        {{ t('searchReplace.replaceAll') }}
      </button>
    </div>
    <div v-if="!isFileScope" class="fb__hint">
      {{ t('findBar.folderHint', { folder: shortRoot(scopeRoot) }) }}
    </div>
    <RegexKeyboard
      v-if="keyboardOpen"
      :target="keyboardTarget"
      :exclude="hiddenTokens"
      @insert="insertToken"
    />
  </div>
</template>

<style scoped>
.fb {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  background: var(--bg-soft);
  border-bottom: 1px solid var(--border);
  font: 12px var(--font-ui);
  color: var(--text);
}
.fb__row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.fb__row--replace {
  padding-inline-start: 22px;
}
.fb__chevron {
  width: 16px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 14px;
  transition: transform 0.12s;
}
.fb__chevron--open {
  transform: rotate(90deg);
}
.fb__field {
  display: flex;
  align-items: center;
  flex: 1 1 220px;
  min-width: 160px;
  max-width: 420px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0 4px 0 8px;
}
.fb__field:focus-within {
  border-color: var(--accent);
}
.fb__field--invalid {
  border-color: var(--danger, #e5534b);
}
.fb__input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  outline: none;
  padding: 4px 0;
  font: 12px var(--font-mono);
  color: var(--text);
  unicode-bidi: plaintext;
}
.fb__opt {
  background: none;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  font: 11px var(--font-mono);
  margin-inline-start: 2px;
  padding: 1px 4px;
}
.fb__opt--on {
  border-color: var(--accent);
  color: var(--accent);
}
.fb__count {
  color: var(--text-faint);
  font-size: 11px;
  min-width: 56px;
}
.fb__btn {
  background: none;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px 6px;
}
.fb__btn:hover {
  border-color: var(--border);
  color: var(--text);
}
.fb__btn--text {
  border-color: var(--border);
  color: var(--text);
  font-size: 11px;
}
.fb__scope {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 4px;
  overflow: hidden;
}
.fb__scope-btn {
  background: var(--bg);
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  padding: 2px 8px;
}
.fb__scope-btn + .fb__scope-btn {
  border-inline-start: 1px solid var(--border);
}
.fb__scope-btn--on {
  background: var(--accent);
  color: var(--accent-fg, #fff);
}
.fb__scope-btn:disabled {
  cursor: default;
  opacity: 0.4;
}
.fb__hint {
  color: var(--text-faint);
  font-size: 11px;
  padding-inline-start: 22px;
}
</style>
