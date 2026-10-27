<script setup lang="ts">
import { toHex6, type ThemeMode, type ThemeToken, type UserTheme } from '../lib/user-theme';
import { useI18n } from '../i18n';

defineProps<{ token: ThemeToken; modes: ThemeMode[]; theme: UserTheme; resetTitle: (mode: ThemeMode) => string }>();
const emit = defineEmits<{
  (e: 'set', mode: ThemeMode, key: string, value: string): void;
  (e: 'reset', mode: ThemeMode, key: string): void;
  (e: 'locate', mode: ThemeMode, key: string): void;
}>();
const { t } = useI18n();
</script>

<template>
  <div class="tok-row" :style="{ '--cols': modes.length }">
    <div class="tok-label" :title="token.key">
      {{ token.label }}
      <span class="tok-hint">{{ token.hint }}</span>
    </div>
    <div v-for="m in modes" :key="m" class="tok-cell">
      <button
        class="tok-locate"
        :title="t('themeStudio.locate')"
        :aria-label="`${t('themeStudio.locate')}: ${token.label} (${m})`"
        @click="emit('locate', m, token.key)"
      >🔍</button>
      <input
        type="color"
        :value="toHex6(theme[m][token.key] ?? '#808080')"
        :aria-label="`${token.label} (${m})`"
        @input="emit('set', m, token.key, ($event.target as HTMLInputElement).value)"
      />
      <input
        class="hex"
        :value="theme[m][token.key]"
        spellcheck="false"
        maxlength="7"
        @change="emit('set', m, token.key, ($event.target as HTMLInputElement).value)"
      />
      <button
        class="tok-reset"
        :class="{ 'tok-reset--off': !theme.edited[m].includes(token.key) }"
        :title="resetTitle(m)"
        :disabled="!theme.edited[m].includes(token.key)"
        @click="emit('reset', m, token.key)"
      >↺</button>
    </div>
  </div>
</template>

<style scoped>
.tok-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) repeat(var(--cols), var(--tok-col, 170px));
  align-items: center;
  column-gap: var(--sp-3);
  padding: 3px 0;
}
.tok-label { color: var(--text); }
.tok-hint { display: block; font-size: 10.5px; color: var(--text-muted); line-height: 1.3; }
.tok-cell { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.tok-cell input[type='color'] {
  width: 28px;
  height: 22px;
  padding: 0;
  border: var(--bd);
  border-radius: var(--r-sm);
  background: none;
  cursor: pointer;
}
.hex {
  width: 74px;
  font: inherit;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text);
  background: var(--bg);
  border: var(--bd);
  border-radius: var(--r-sm);
  padding: 3px 6px;
}
.tok-locate, .tok-reset {
  border: none;
  background: transparent;
  padding: 0 3px;
  cursor: pointer;
  font-size: 12px;
  color: var(--accent);
}
.tok-locate { opacity: 0.55; }
.tok-locate:hover, .tok-locate:focus-visible { opacity: 1; }
.tok-reset--off { visibility: hidden; }
</style>
