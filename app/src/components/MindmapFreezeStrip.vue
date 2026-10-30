<script setup lang="ts">
import { computed } from 'vue';
import type { FreezeStrip, StripChip } from '../lib/mindmap/focus';
import { branchColorAt, EMPTY_FRAME_STYLE, type StripFrameStyle } from '../lib/mindmap/frame-style';
import { useSettingsStore } from '../stores/settings';
import { useI18n } from '../i18n';

const props = withDefaults(defineProps<{ strip: FreezeStrip; focusId: string | null; frameStyle?: StripFrameStyle }>(), { frameStyle: () => EMPTY_FRAME_STYLE });
const emit = defineEmits<{ focus: [id: string | null]; anchor: [id: string] }>();
const { t } = useI18n();
const settings = useSettingsStore();
const isFramed = computed(() => settings.mindmapControlStyle === 'classic');

function chipStyle(chip: StripChip, index: number): Record<string, string> {
  const style: Record<string, string> = {};
  const branch = isFramed.value ? branchColorAt(props.frameStyle.palette, props.strip.branchIndex ?? index, chip.branch) : undefined;
  if (branch) style.borderColor = branch;
  if (chip.color) style.color = chip.color;
  if (chip.background) style.background = chip.background;
  return style;
}

const isAnchored = computed(() => props.strip.ancestors.length > 0);
const rootFocusId = computed(() => (isAnchored.value ? props.strip.root.id : null));

function onChip(event: MouseEvent, id: string): void {
  if (event.altKey) emit('anchor', id);
  else emit('focus', id);
}
</script>

<template>
  <nav class="mm-strip" :class="{ 'mm-strip--framed': isFramed }" :style="isFramed ? frameStyle.vars : undefined" :aria-label="t('mindmap.focusStripLabel')">
    <div class="mm-strip__row">
      <ol v-if="isAnchored" class="mm-strip__crumbs mm-strip__ancestors">
        <li v-for="chip in strip.ancestors" :key="chip.id">
          <button type="button" class="mm-strip__crumb" dir="auto" :title="t('mindmap.stripAncestorHint')" @click="emit('anchor', chip.id)">{{ chip.topic }}</button>
        </li>
      </ol>
      <button type="button" class="mm-strip__chip mm-strip__chip--root" dir="auto" :title="isAnchored ? t('mindmap.stripChipHint') : t('mindmap.focusWholeMap')" :aria-current="focusId === rootFocusId ? 'true' : undefined" @click="emit('focus', rootFocusId)">
        {{ strip.root.topic }}
      </button>
    </div>
    <div class="mm-strip__row">
      <button
        v-for="(chip, index) in strip.level2"
        :key="chip.id"
        type="button"
        class="mm-strip__chip"
        :class="{ 'mm-strip__chip--active': chip.id === strip.activeLevel2Id }"
        dir="auto"
        :style="chipStyle(chip, index)"
        :aria-current="chip.id === focusId ? 'true' : undefined"
        :title="t('mindmap.stripChipHint')"
        @click="onChip($event, chip.id)"
      >
        <span v-for="icon in chip.icons" :key="icon">{{ icon }}</span>
        {{ chip.topic }}
        <span v-for="tag in chip.tags" :key="tag" class="mm-strip__tag">{{ tag }}</span>
      </button>
    </div>
    <ol v-if="strip.breadcrumb.length > 0" class="mm-strip__row mm-strip__crumbs">
      <li v-for="chip in strip.breadcrumb" :key="chip.id">
        <button type="button" class="mm-strip__crumb" dir="auto" :aria-current="chip.id === focusId ? 'true' : undefined" :title="t('mindmap.stripChipHint')" @click="onChip($event, chip.id)">{{ chip.topic }}</button>
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
.mm-strip__ancestors { display: flex; align-items: center; margin: 0; padding: 0; list-style: none; opacity: 0.75; }
.mm-strip__ancestors li:last-child::after { content: '›'; margin-inline: 2px 4px; color: var(--text-faint); }
.mm-strip__ancestors li:last-child:dir(rtl)::after { content: '‹'; }

.mm-strip--framed {
  --frame-surface: color-mix(in srgb, var(--bgcolor, var(--bg)) 88%, var(--text) 12%);
  position: relative;
  z-index: 1;
  gap: 12px;
  padding-block: 14px 16px;
  padding-inline: 16px;
  background: var(--frame-surface);
  border-block-end: 2px solid color-mix(in srgb, var(--text) 35%, transparent);
  box-shadow: 0 6px 14px -6px rgb(0 0 0 / 45%);
}
.mm-strip--framed .mm-strip__row { justify-content: center; gap: 10px 14px; }
.mm-strip--framed .mm-strip__chip { padding-block: 6px; padding-inline: 16px; border: 2px solid var(--border); border-radius: var(--main-radius, 999px); background: var(--main-bgcolor, var(--bg-elev)); color: var(--main-color, var(--text)); font-size: 13px; box-shadow: 0 1px 2px rgb(0 0 0 / 20%); }
.mm-strip--framed .mm-strip__chip--root { padding-block: 8px; padding-inline: 22px; border: 2px solid var(--root-border-color, var(--border)); border-radius: var(--root-radius, 12px); background: var(--root-bgcolor, var(--bg-elev)); color: var(--root-color, var(--text)); font-size: 15px; }
.mm-strip--framed .mm-strip__chip--active { box-shadow: 0 0 0 2px var(--accent); }
.mm-strip--framed .mm-strip__chip:hover { filter: brightness(1.12); }
.mm-strip--framed .mm-strip__crumb { font-size: 13px; }
</style>
