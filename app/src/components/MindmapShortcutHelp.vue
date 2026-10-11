<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from '../i18n';
import { useSettingsStore } from '../stores/settings';
import { activeKeyActions, combosFor, formatCombo } from '../lib/keybindings';
import { MINDMAP_BUILTIN_KEYS } from '../lib/mindmap-keymap';
import { isMacOS } from '../lib/platform';

const emit = defineEmits<{ (e: 'close'): void }>();
const { t } = useI18n();
const settings = useSettingsStore();
const isMac = isMacOS();

const builtinRows = computed(() =>
  MINDMAP_BUILTIN_KEYS.map((k) => ({ keys: formatCombo(k.combo, isMac), label: k.label })),
);
const customRows = computed(() =>
  activeKeyActions()
    .filter((a) => a.scope === 'mindmap')
    .map((a) => ({
      keys: combosFor(a.id, settings.keybindings).map((c) => formatCombo(c, isMac)).join(' / ') || '—',
      label: a.label.replace(/^Mindmap: /, ''),
    })),
);

function closeOnEscape(e: KeyboardEvent): void {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  e.stopPropagation();
  emit('close');
}

onMounted(() => window.addEventListener('keydown', closeOnEscape, true));
onBeforeUnmount(() => window.removeEventListener('keydown', closeOnEscape, true));
</script>

<template>
  <div class="mm-help" role="dialog" :aria-label="t('mindmap.shortcutsTitle')" @click.self="emit('close')">
    <div class="mm-help__card">
      <header class="mm-help__head">
        <h3>{{ t('mindmap.shortcutsTitle') }}</h3>
        <button type="button" @click="emit('close')">{{ t('mindmap.close') }}</button>
      </header>
      <h4>{{ t('mindmap.builtinSection') }}</h4>
      <dl><template v-for="row in builtinRows" :key="row.keys + row.label"><dt>{{ row.keys }}</dt><dd>{{ row.label }}</dd></template></dl>
      <h4>{{ t('mindmap.customSection') }}</h4>
      <dl><template v-for="row in customRows" :key="row.label"><dt>{{ row.keys }}</dt><dd>{{ row.label }}</dd></template></dl>
    </div>
  </div>
</template>

<style scoped>
.mm-help { position: absolute; inset: 0; display: grid; place-items: center; background: rgb(0 0 0 / 0.35); z-index: 20; }
.mm-help__card { background: var(--bg, #fff); color: var(--text, #222); border-radius: 8px; padding: 16px 20px; max-height: 80%; overflow: auto; min-width: 320px; }
.mm-help__head { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 4px 16px; margin: 0 0 12px; }
dt { font-family: var(--font-mono, monospace); white-space: nowrap; }
dd { margin: 0; }
</style>
