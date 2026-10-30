<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import MindmapIcon, { type MindmapIconName } from './MindmapIcon.vue';
import { CLOSED_FLYOUT, isFlyoutKey, moveFlyout, toggleFlyout, type FlyoutState } from '../lib/mindmap/flyout';

export interface FlyoutOption {
  readonly id: string;
  readonly label: string;
  readonly icon?: MindmapIconName;
}

const props = withDefaults(defineProps<{ icon: MindmapIconName; label: string; options: readonly FlyoutOption[]; selectedId?: string | null; disabled?: boolean }>(), { selectedId: null, disabled: false });
const emit = defineEmits<{ pick: [id: string] }>();
const host = ref<HTMLElement | null>(null);
const items = ref<HTMLButtonElement[]>([]);
const state = ref<FlyoutState>(CLOSED_FLYOUT);
const selectedIndex = computed(() => props.options.findIndex((o) => o.id === props.selectedId));

function close(): void {
  state.value = CLOSED_FLYOUT;
}

function closeOnOutsidePointer(event: PointerEvent): void {
  if (!host.value?.contains(event.target as Node | null)) close();
}

function toggle(): void {
  state.value = toggleFlyout(state.value, selectedIndex.value, props.options.length);
}

function onKey(event: KeyboardEvent): void {
  if (!state.value.isOpen || !isFlyoutKey(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  state.value = moveFlyout(state.value, event.key, props.options.length);
}

function pick(id: string): void {
  close();
  emit('pick', id);
}

watch(() => state.value.isOpen, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', closeOnOutsidePointer, true);
  else document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
});
watch(() => state.value.activeIndex, async (index) => {
  await nextTick();
  if (index >= 0) items.value[index]?.focus();
});
watch(() => props.disabled, (isDisabled) => { if (isDisabled) close(); });
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutsidePointer, true));
</script>

<template>
  <div ref="host" class="mm-flyout" @keydown="onKey">
    <button type="button" class="mm-dock-btn mm-flyout__trigger" :title="label" :aria-label="label" aria-haspopup="menu" :aria-expanded="state.isOpen" :disabled="disabled" @click="toggle">
      <MindmapIcon :name="icon" />
      <span class="mm-flyout__caret" aria-hidden="true" />
    </button>
    <div v-if="state.isOpen" class="mm-flyout__menu" role="menu" :aria-label="label">
      <button
        v-for="(option, index) in options"
        :key="option.id"
        ref="items"
        type="button"
        :role="selectedId === null ? 'menuitem' : 'menuitemradio'"
        class="mm-flyout__item"
        :aria-checked="selectedId === null ? undefined : option.id === selectedId"
        :tabindex="index === state.activeIndex ? 0 : -1"
        @click="pick(option.id)"
      >
        <MindmapIcon v-if="option.icon" :name="option.icon" />
        <span>{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>

<style>
.mm-flyout { position: relative; display: inline-flex; }
.mm-flyout__trigger { position: relative; }
.mm-flyout__caret { position: absolute; inset-block-end: 3px; inset-inline-end: 3px; width: 0; height: 0; border-block-start: 4px solid transparent; border-inline-end: 4px solid currentColor; opacity: 0.6; }
.mm-flyout__menu { position: absolute; z-index: 25; inset-block-start: 0; inset-inline-start: calc(100% + 6px); display: flex; flex-direction: column; min-width: 160px; padding: 4px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 4px 16px rgb(0 0 0 / 22%); }
.mm-dock--top-end .mm-flyout__menu { inset-inline-start: auto; inset-inline-end: 0; inset-block-start: calc(100% + 6px); }
.mm-flyout__item { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border: 0; border-radius: 5px; background: transparent; color: inherit; font-size: 12px; text-align: start; cursor: pointer; white-space: nowrap; }
.mm-flyout__item:hover, .mm-flyout__item:focus-visible { background: var(--bg-hover, var(--bg)); outline: none; }
.mm-flyout__item[aria-checked='true'] { color: var(--accent); }
</style>
