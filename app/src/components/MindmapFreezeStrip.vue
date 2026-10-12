<script setup lang="ts">
import type { FreezeStrip, StripChip } from '../lib/mindmap-focus';
import { useI18n } from '../i18n';

defineProps<{ strip: FreezeStrip; focusId: string | null }>();
const emit = defineEmits<{ focus: [id: string | null] }>();
const { t } = useI18n();

function chipStyle(chip: StripChip): Record<string, string> {
  const style: Record<string, string> = {};
  if (chip.color) style.color = chip.color;
  if (chip.background) style.background = chip.background;
  return style;
}
</script>

<template>
  <nav class="mm-strip" :aria-label="t('mindmap.focusStripLabel')">
    <div class="mm-strip__row">
      <button type="button" class="mm-strip__chip mm-strip__chip--root" dir="auto" :title="t('mindmap.focusWholeMap')" :aria-current="focusId === null ? 'true' : undefined" @click="emit('focus', null)">
        {{ strip.root.topic }}
      </button>
    </div>
    <div class="mm-strip__row">
      <button
        v-for="chip in strip.level2"
        :key="chip.id"
        type="button"
        class="mm-strip__chip"
        :class="{ 'mm-strip__chip--active': chip.id === strip.activeLevel2Id }"
        dir="auto"
        :style="chipStyle(chip)"
        :aria-current="chip.id === focusId ? 'true' : undefined"
        @click="emit('focus', chip.id)"
      >
        <span v-for="icon in chip.icons" :key="icon">{{ icon }}</span>
        {{ chip.topic }}
        <span v-for="tag in chip.tags" :key="tag" class="mm-strip__tag">{{ tag }}</span>
      </button>
    </div>
    <ol v-if="strip.breadcrumb.length > 0" class="mm-strip__row mm-strip__crumbs">
      <li v-for="chip in strip.breadcrumb" :key="chip.id">
        <button type="button" class="mm-strip__crumb" dir="auto" :aria-current="chip.id === focusId ? 'true' : undefined" @click="emit('focus', chip.id)">{{ chip.topic }}</button>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.mm-strip { display: flex; flex-direction: column; gap: 4px; padding-block: 6px; padding-inline: 8px; background: var(--bg-elev); border-block-end: 1px solid var(--border); }
.mm-strip__row { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
.mm-strip__chip { padding-block: 2px; padding-inline: 10px; border-radius: 999px; border: 1px solid var(--border); background: var(--bg); color: var(--text); font-size: 12px; cursor: pointer; unicode-bidi: plaintext; }
.mm-strip__chip--root { font-weight: 600; }
.mm-strip__chip--active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.mm-strip__tag { margin-inline-start: 4px; font-size: 10px; color: var(--text-faint); }
.mm-strip__crumbs li { display: flex; align-items: center; }
.mm-strip__crumbs li + li::before { content: '›'; margin-inline-end: 6px; color: var(--text-faint); }
.mm-strip__crumb { background: none; border: 0; color: var(--text); font-size: 12px; cursor: pointer; unicode-bidi: plaintext; }
.mm-strip__crumbs li + li:dir(rtl)::before { content: '‹'; }
</style>
