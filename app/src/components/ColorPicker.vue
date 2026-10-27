<script setup lang="ts">
/* One-page colour picker: shade square, hue strip, hex and this theme's own
 * colours, all in a single popover. Replaces the native picker, whose macOS
 * panel spreads the same choice over several tabs. */
import { computed, nextTick, onBeforeUnmount, ref } from 'vue';
import { hexToHsv, hsvToHex, type Hsv } from '../lib/color-hsv';
import { isHexColor, toHex6 } from '../lib/user-theme';

const props = defineProps<{ modelValue: string; label: string; swatches?: string[] }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>();

const POPOVER_WIDTH = 236;
const POPOVER_HEIGHT = 300;
const EDGE_GAP = 8;
const FULL_TURN = 360;

const trigger = ref<HTMLButtonElement | null>(null);
const square = ref<HTMLDivElement | null>(null);
const isOpen = ref(false);
const pos = ref({ left: 0, top: 0 });
const hsv = ref<Hsv>({ h: 0, s: 0, v: 0 });
const hexText = ref('');

const hex = computed(() => toHex6(props.modelValue || '#808080'));
const hueColor = computed(() => hsvToHex({ h: hsv.value.h, s: 1, v: 1 }));
const uniqueSwatches = computed(() => [...new Set((props.swatches ?? []).map((c) => toHex6(c)))]);

function place() {
  const r = trigger.value!.getBoundingClientRect();
  const below = r.bottom + EDGE_GAP + POPOVER_HEIGHT <= window.innerHeight;
  const top = below ? r.bottom + EDGE_GAP : Math.max(EDGE_GAP, r.top - EDGE_GAP - POPOVER_HEIGHT);
  const left = Math.min(Math.max(EDGE_GAP, r.left), window.innerWidth - POPOVER_WIDTH - EDGE_GAP);
  pos.value = { left, top };
}

function open() {
  hsv.value = hexToHsv(hex.value);
  hexText.value = hex.value;
  place();
  isOpen.value = true;
  window.addEventListener('pointerdown', onOutside, true);
  window.addEventListener('keydown', onKey, true);
}

function close() {
  isOpen.value = false;
  window.removeEventListener('pointerdown', onOutside, true);
  window.removeEventListener('keydown', onKey, true);
}

function onOutside(e: PointerEvent) {
  const target = e.target as Node;
  if (trigger.value?.contains(target) || (target as Element).closest?.('.cp-pop')) return;
  close();
}

/** Window capture runs before the Settings modal's own Escape, so Esc closes only the picker. */
function onKey(e: KeyboardEvent) {
  if (e.key !== 'Escape') return;
  e.preventDefault();
  e.stopImmediatePropagation();
  close();
  void nextTick(() => trigger.value?.focus());
}

function commit(next: Hsv) {
  hsv.value = next;
  const value = hsvToHex(next);
  hexText.value = value;
  emit('update:modelValue', value);
}

function pickAt(e: PointerEvent) {
  const r = square.value!.getBoundingClientRect();
  const clamp = (n: number): number => Math.min(1, Math.max(0, n));
  commit({ h: hsv.value.h, s: clamp((e.clientX - r.left) / r.width), v: clamp(1 - (e.clientY - r.top) / r.height) });
}

function startDrag(e: PointerEvent) {
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  pickAt(e);
}

function onDrag(e: PointerEvent) {
  if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) pickAt(e);
}

function setHue(h: number) {
  commit({ ...hsv.value, h: h % FULL_TURN });
}

function setHex(value: string) {
  const v = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
  if (!isHexColor(v)) return;
  hsv.value = hexToHsv(toHex6(v));
  emit('update:modelValue', toHex6(v));
}

function useSwatch(color: string) {
  hsv.value = hexToHsv(color);
  hexText.value = color;
  emit('update:modelValue', color);
}

onBeforeUnmount(close);
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="cp-swatch"
    :style="{ background: hex }"
    :aria-label="label"
    :aria-expanded="isOpen"
    @click="isOpen ? close() : open()"
  />
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="cp-pop"
      role="dialog"
      :aria-label="label"
      :style="{ left: `${pos.left}px`, top: `${pos.top}px`, width: `${POPOVER_WIDTH}px` }"
    >
      <div
        ref="square"
        class="cp-square"
        :style="{ background: hueColor }"
        @pointerdown="startDrag"
        @pointermove="onDrag"
      >
        <span class="cp-thumb" :style="{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }" />
      </div>
      <input
        class="cp-hue"
        type="range"
        min="0"
        max="359"
        :value="Math.round(hsv.h)"
        :aria-label="`${label} hue`"
        @input="setHue(Number(($event.target as HTMLInputElement).value))"
      />
      <div class="cp-row">
        <span class="cp-now" :style="{ background: hex }" />
        <input
          v-model="hexText"
          class="cp-hex"
          spellcheck="false"
          maxlength="7"
          :aria-label="`${label} hex`"
          @input="setHex(hexText)"
        />
      </div>
      <div v-if="uniqueSwatches.length" class="cp-swatches">
        <button
          v-for="c in uniqueSwatches"
          :key="c"
          type="button"
          class="cp-chip"
          :class="{ 'cp-chip--on': c === hex }"
          :style="{ background: c }"
          :title="c"
          @click="useSwatch(c)"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cp-swatch {
  width: 28px;
  height: 22px;
  padding: 0;
  border: var(--bd);
  border-radius: var(--r-sm);
  cursor: pointer;
}
.cp-pop {
  position: fixed;
  z-index: calc(var(--z-modal) + 1);
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  box-shadow: var(--sh-pop);
  color: var(--text);
  font-size: 12px;
}
.cp-square {
  position: relative;
  height: 140px;
  border-radius: var(--r-sm);
  cursor: crosshair;
  touch-action: none;
}
.cp-square::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent);
}
.cp-thumb {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border: 2px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
  pointer-events: none;
}
.cp-hue {
  width: 100%;
  height: 12px;
  margin: 0;
  appearance: none;
  border-radius: 6px;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  cursor: pointer;
}
.cp-hue::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: transparent;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.5);
}
.cp-row { display: flex; align-items: center; gap: 8px; }
.cp-now { width: 28px; height: 22px; border: var(--bd); border-radius: var(--r-sm); }
.cp-hex {
  flex: 1;
  font: inherit;
  font-family: var(--font-mono);
  color: var(--text);
  background: var(--bg);
  border: var(--bd);
  border-radius: var(--r-sm);
  padding: 3px 6px;
}
.cp-swatches { display: grid; grid-template-columns: repeat(9, 1fr); gap: 4px; }
.cp-chip {
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid rgba(128, 128, 128, 0.5);
  border-radius: 4px;
  cursor: pointer;
}
.cp-chip--on { outline: 2px solid var(--accent); outline-offset: 1px; }
</style>
