<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from '../i18n';
import { useSettingsStore } from '../stores/settings';
import { activeKeyActions, combosFor, formatCombo } from '../lib/keybindings';
import { MINDMAP_BUILTIN_KEYS } from '../lib/mindmap/keymap';
import { isMacOS } from '../lib/platform';

interface Point { x: number; y: number }

const emit = defineEmits<{ (e: 'close'): void }>();
const { t } = useI18n();
const settings = useSettingsStore();
const isMac = isMacOS();

const panel = ref<HTMLElement | null>(null);
const position = ref<Point | null>(lastPosition);
let dragOffset: Point | null = null;

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
const panelStyle = computed(() =>
  position.value ? { left: `${position.value.x}px`, top: `${position.value.y}px`, right: 'auto' } : {},
);

function clamp(value: number, max: number): number {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

function startDrag(e: PointerEvent): void {
  const el = panel.value;
  if (!el || (e.target as HTMLElement).closest('button')) return;
  const rect = el.getBoundingClientRect();
  dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}

function onDrag(e: PointerEvent): void {
  const el = panel.value;
  const host = el?.offsetParent as HTMLElement | null;
  if (!dragOffset || !el || !host) return;
  const hostRect = host.getBoundingClientRect();
  position.value = {
    x: clamp(e.clientX - hostRect.left - dragOffset.x, hostRect.width - el.offsetWidth),
    y: clamp(e.clientY - hostRect.top - dragOffset.y, hostRect.height - el.offsetHeight),
  };
}

function endDrag(): void {
  dragOffset = null;
  lastPosition = position.value;
}

</script>

<script lang="ts">
let lastPosition: { x: number; y: number } | null = null;
</script>

<template>
  <aside
    ref="panel"
    class="mm-help"
    :style="panelStyle"
    :aria-label="t('mindmap.shortcutsTitle')"
    data-testid="mindmap-shortcut-help"
    @pointerdown.stop
    @mousedown.prevent
    @wheel.stop
  >
    <header
      class="mm-help__head"
      @pointerdown="startDrag"
      @pointermove="onDrag"
      @pointerup="endDrag"
      @pointercancel="endDrag"
    >
      <h3>{{ t('mindmap.shortcutsTitle') }}</h3>
      <button type="button" :title="t('mindmap.close')" :aria-label="t('mindmap.close')" @click="emit('close')">✕</button>
    </header>
    <div class="mm-help__body">
      <h4>{{ t('mindmap.builtinSection') }}</h4>
      <dl><template v-for="row in builtinRows" :key="row.keys + row.label"><dt>{{ row.keys }}</dt><dd>{{ row.label }}</dd></template></dl>
      <h4>{{ t('mindmap.customSection') }}</h4>
      <dl><template v-for="row in customRows" :key="row.label"><dt>{{ row.keys }}</dt><dd>{{ row.label }}</dd></template></dl>
    </div>
  </aside>
</template>

<style scoped>
.mm-help {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  width: 300px;
  max-height: calc(100% - 24px);
  background: var(--bg, #fff);
  color: var(--text, #222);
  border: 1px solid var(--border, rgb(0 0 0 / 0.12));
  border-radius: 8px;
  box-shadow: 0 6px 24px rgb(0 0 0 / 0.18);
  font-size: 12px;
}
.mm-help__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  border-bottom: 1px solid var(--border, rgb(0 0 0 / 0.12));
  cursor: move;
  user-select: none;
  touch-action: none;
}
.mm-help__head h3 { margin: 0; font-size: 13px; }
.mm-help__head button {
  background: transparent;
  border: none;
  color: var(--text-muted, inherit);
  cursor: pointer;
  border-radius: 4px;
  padding: 0 6px;
}
.mm-help__head button:hover { color: var(--accent, inherit); }
.mm-help__body { overflow: auto; padding: 4px 12px 8px; }
h4 { margin: 8px 0 4px; font-size: 11px; text-transform: uppercase; color: var(--text-muted, inherit); }
dl { display: grid; grid-template-columns: max-content 1fr; gap: 3px 12px; margin: 0 0 8px; }
dt { font-family: var(--font-mono, monospace); white-space: nowrap; }
dd { margin: 0; }
</style>
