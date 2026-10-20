<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue';
import GitBranchTree from './GitBranchTree.vue';
import GitGraph from './GitGraph.vue';
import GitCommitDetails from './GitCommitDetails.vue';

const WIDTHS_KEY = 'solomd.gitLog.widths';
const DEFAULT_WIDTHS: [number, number] = [220, 320];
const MIN_COL_PX = 120;

function loadWidths(): [number, number] {
  try {
    const raw = JSON.parse(localStorage.getItem(WIDTHS_KEY) ?? 'null');
    return Array.isArray(raw) && raw.length === 2 ? [Number(raw[0]), Number(raw[1])] : DEFAULT_WIDTHS;
  } catch {
    return DEFAULT_WIDTHS;
  }
}

const widths = ref<[number, number]>(loadWidths());

let stopDrag: (() => void) | null = null;

function drag(index: 0 | 1, down: PointerEvent): void {
  const startX = down.clientX;
  const start = widths.value[index];
  const isRtl = getComputedStyle(document.documentElement).direction === 'rtl';
  const sign = (index === 0 ? 1 : -1) * (isRtl ? -1 : 1);
  const onMove = (move: PointerEvent): void => {
    const next: [number, number] = [widths.value[0], widths.value[1]];
    next[index] = Math.max(MIN_COL_PX, start + sign * (move.clientX - startX));
    widths.value = next;
  };
  const detach = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    stopDrag = null;
  };
  const onUp = (): void => {
    detach();
    try { localStorage.setItem(WIDTHS_KEY, JSON.stringify(widths.value)); } catch { /* storage unavailable */ }
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  stopDrag = detach;
}

onBeforeUnmount(() => stopDrag?.());
</script>

<template>
  <div class="git-log">
    <GitBranchTree :style="{ inlineSize: `${widths[0]}px` }" />
    <div class="git-log__split" @pointerdown.prevent="drag(0, $event)" />
    <GitGraph class="git-log__graph" />
    <div class="git-log__split" @pointerdown.prevent="drag(1, $event)" />
    <GitCommitDetails :style="{ inlineSize: `${widths[1]}px` }" />
  </div>
</template>
