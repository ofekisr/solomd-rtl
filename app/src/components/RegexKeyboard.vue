<script setup lang="ts">
/**
 * Tap-to-insert regex tokens for the Search-in-Folder pane. `target` picks the
 * set: pattern tokens for the find field, group / escape tokens for replace.
 * `wrap` tokens surround the current selection (e.g. a capture group).
 */
import { computed } from 'vue';
import { useI18n } from '../i18n';

export interface RegexToken {
  label: string;
  insert: string;
  wrap?: [string, string];
  hint: string;
}

const props = defineProps<{ target: 'find' | 'replace' }>();
const emit = defineEmits<{ (e: 'insert', token: RegexToken): void }>();
const { t } = useI18n();

const FIND_TOKENS: Array<Omit<RegexToken, 'hint'> & { key: string }> = [
  { key: 'lineStart', label: '^', insert: '^' },
  { key: 'lineEnd', label: '$', insert: '$' },
  { key: 'anyChar', label: '.', insert: '.' },
  { key: 'anything', label: '.*', insert: '.*' },
  { key: 'digit', label: '\\d', insert: '\\d' },
  { key: 'word', label: '\\w', insert: '\\w' },
  { key: 'space', label: '\\s', insert: '\\s' },
  { key: 'boundary', label: '\\b', insert: '\\b' },
  { key: 'group', label: '( )', insert: '()', wrap: ['(', ')'] },
  { key: 'named', label: '(?<n>)', insert: '(?<name>)', wrap: ['(?<name>', ')'] },
  { key: 'set', label: '[ ]', insert: '[]', wrap: ['[', ']'] },
  { key: 'or', label: '|', insert: '|' },
  { key: 'oneOrMore', label: '+', insert: '+' },
  { key: 'zeroOrMore', label: '*', insert: '*' },
  { key: 'optional', label: '?', insert: '?' },
  { key: 'lazy', label: '+?', insert: '+?' },
];

const REPLACE_TOKENS: Array<Omit<RegexToken, 'hint'> & { key: string }> = [
  { key: 'group1', label: '$1', insert: '$1' },
  { key: 'group2', label: '$2', insert: '$2' },
  { key: 'group3', label: '$3', insert: '$3' },
  { key: 'namedRef', label: '$<n>', insert: '$<name>' },
  { key: 'whole', label: '$&', insert: '$&' },
  { key: 'newline', label: '\\n', insert: '\\n' },
  { key: 'tab', label: '\\t', insert: '\\t' },
  { key: 'dollar', label: '$$', insert: '$$' },
];

const tokens = computed<RegexToken[]>(() =>
  (props.target === 'find' ? FIND_TOKENS : REPLACE_TOKENS).map(({ key, ...tok }) => ({
    ...tok,
    hint: t(`searchReplace.tokens.${key}`),
  })),
);
</script>

<template>
  <div class="rk" role="toolbar" :aria-label="t('searchReplace.keyboard')">
    <button
      v-for="tok in tokens"
      :key="tok.label"
      class="rk__key"
      type="button"
      :title="`${tok.label} — ${tok.hint}`"
      @mousedown.prevent
      @click="emit('insert', tok)"
    >{{ tok.label }}</button>
  </div>
</template>

<style scoped>
.rk {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-soft);
  direction: ltr;
}
.rk__key {
  min-width: 26px;
  padding: 2px 5px;
  border: 1px solid var(--border);
  border-radius: 3px;
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  font: 11px var(--font-mono);
}
.rk__key:hover {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
