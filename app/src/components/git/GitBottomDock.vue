<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { useSettingsStore } from '../../stores/settings';
import { useI18n } from '../../i18n';
import GitLog from './GitLog.vue';

const MIN_DOCK_PX = 120;
const MAX_DOCK_RATIO = 0.8;

const settings = useSettingsStore();
const { t } = useI18n();

let stopResize: (() => void) | null = null;

function startResize(down: PointerEvent): void {
  const startY = down.clientY;
  const startHeight = settings.gitDockHeight;
  const maxPx = window.innerHeight * MAX_DOCK_RATIO;
  const onMove = (move: PointerEvent): void => {
    settings.gitDockHeight = Math.min(maxPx, Math.max(MIN_DOCK_PX, startHeight + (startY - move.clientY)));
  };
  const detach = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    stopResize = null;
  };
  const onUp = (): void => {
    detach();
    settings.setGitDockHeight(settings.gitDockHeight);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  stopResize = detach;
}

onBeforeUnmount(() => {
  if (!stopResize) return;
  stopResize();
  settings.setGitDockHeight(settings.gitDockHeight);
});
</script>

<template>
  <section class="git-dock" :style="{ blockSize: `${settings.gitDockHeight}px` }">
    <div class="git-dock__resize" @pointerdown.prevent="startResize" />
    <div class="git-dock__tabs">
      <button class="git-dock__tab git-dock__tab--active">{{ t('git.logTitle') }}</button>
      <span class="git-dock__spacer" />
      <button class="git-dock__close" :aria-label="t('git.closeLog')" @click="settings.toggleGitLog()">✕</button>
    </div>
    <GitLog />
  </section>
</template>
