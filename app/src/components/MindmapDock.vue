<script setup lang="ts">
import { useSettingsStore } from '../stores/settings';

export type DockCorner = 'top-start' | 'top-end' | 'bottom-end';
export type DockOrientation = 'row' | 'column';

defineProps<{ corner: DockCorner; orientation: DockOrientation; label: string }>();
const settings = useSettingsStore();
</script>

<template>
  <div class="mm-dock" :class="[`mm-dock--${corner}`, `mm-dock--${orientation}`, `mm-dock--${settings.mindmapControlStyle}`]" role="toolbar" :aria-label="label" :aria-orientation="orientation === 'row' ? 'horizontal' : 'vertical'">
    <slot />
  </div>
</template>

<style>
.mm-dock { position: absolute; z-index: 15; display: flex; gap: 2px; padding: 4px; border-radius: 8px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); box-shadow: 0 2px 8px rgb(0 0 0 / 18%); }
.mm-dock--row { flex-direction: row; align-items: center; }
.mm-dock--column { flex-direction: column; }
.mm-dock--top-start { inset-block-start: 12px; inset-inline-start: 12px; }
.mm-dock--top-end { inset-block-start: 12px; inset-inline-end: 12px; }
.mm-dock--bottom-end { inset-block-end: 12px; inset-inline-end: 12px; }
.mm-dock-sep { flex: none; background: var(--border); }
.mm-dock--column .mm-dock-sep { height: 1px; margin: 2px 4px; }
.mm-dock--row .mm-dock-sep { width: 1px; align-self: stretch; margin: 4px 2px; }
.mm-dock-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; border: 1px solid transparent; border-radius: 6px; background: transparent; color: inherit; cursor: pointer; }
.mm-dock-btn:hover:not(:disabled) { background: var(--bg-hover, var(--bg)); }
.mm-dock-btn:disabled { opacity: 0.4; cursor: default; }
.mm-dock-btn[aria-pressed='true'], .mm-dock-btn[aria-expanded='true'] { border-color: var(--border); background: var(--bg); color: var(--accent); }
.mm-dock--classic { gap: 6px; padding: 8px; border-radius: 5px; }
.mm-dock--classic .mm-dock-btn { width: 30px; height: 30px; border-radius: 4px; }
.mm-dock--classic .mm-dock-btn:hover:not(:disabled) { background: transparent; opacity: 0.7; }
.mm-dock-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
</style>
