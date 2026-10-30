<script setup lang="ts">
import { inject } from 'vue';
import { useI18n } from '../../../i18n';
import { useMeasureOnUpdate } from './useToolbarOverflow.ts';
import { WINDOWS_CAPTION } from './useWindowsCaption.ts';

const { t } = useI18n();
const caption = inject(WINDOWS_CAPTION);
if (!caption) throw new Error('WINDOWS_CAPTION not provided');
const { isMaximized, maxBtnHover, maxBtnRef, winMinimize, winToggleMax, winClose } = caption;
useMeasureOnUpdate();
</script>

<template>
  <!-- Windows caption buttons. `position: sticky; right: 0` keeps them
       pinned even when the strip scrolls horizontally on narrow windows.
       The maximize button doubles as the Snap-Layouts target: on the real
       main window the Rust subclass claims its rect via WM_NCHITTEST, so
       hover/click are handled natively and mirrored back through the
       `solomd://maxbtn-hover` event (hence `.is-hover`, not `:hover`). -->
  <div class="win-controls" data-no-drag>
    <button class="win-controls__btn" @click="winMinimize" :title="t('menubar.minimize')" tabindex="-1">
      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 5h10" stroke="currentColor" stroke-width="1" /></svg>
    </button>
    <button
      ref="maxBtnRef"
      class="win-controls__btn win-controls__btn--max"
      :class="{ 'is-hover': maxBtnHover }"
      @click="winToggleMax"
      :title="isMaximized ? t('menubar.restore') : t('menubar.maximize')"
      tabindex="-1"
    >
      <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1" /></svg>
      <svg v-else width="10" height="10" viewBox="0 0 10 10"><path d="M2.5 2.5V0.5h7v7h-2" fill="none" stroke="currentColor" stroke-width="1" /><rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1" /></svg>
    </button>
    <button class="win-controls__btn win-controls__btn--close" @click="winClose" :title="t('menubar.close')" tabindex="-1">
      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M0 0l10 10M10 0L0 10" stroke="currentColor" stroke-width="1" /></svg>
    </button>
  </div>
</template>

<style scoped src="./win-controls.css"></style>
