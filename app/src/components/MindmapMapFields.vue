<script setup lang="ts">
import { computed, useId } from 'vue';
import { useI18n } from '../i18n';
import { MAP_THEMES, type MapThemeId } from '../lib/mindmap/themes';
import { useThemeStore } from '../stores/theme';
import type { BranchStyle, FoldedCountMode, MapDisplay, MapFont } from '../lib/mindmap/display';

const props = defineProps<{ value: MapDisplay; inherited?: MapDisplay; disabled?: boolean }>();
const emit = defineEmits<{ set: [patch: MapDisplay]; clear: [key: keyof MapDisplay] }>();
const { t } = useI18n();
const themeStore = useThemeStore();
const themeLabelId = useId();
const family = computed(() => themeStore.mode);
const currentTheme = computed<MapThemeId>(() => props.value.theme ?? props.inherited?.theme ?? 'default');

const FOLDED_COUNT_OPTIONS: readonly { value: FoldedCountMode; labelKey: string }[] = [
  { value: 'both', labelKey: 'mindmap.foldedCountBoth' },
  { value: 'all', labelKey: 'mindmap.foldedCountAll' },
  { value: 'direct', labelKey: 'mindmap.foldedCountDirect' },
  { value: 'off', labelKey: 'mindmap.foldedCountOff' },
];

const BRANCH_OPTIONS: readonly { value: BranchStyle; labelKey: string }[] = [
  { value: 'curve', labelKey: 'mindmap.branchCurve' },
  { value: 'straight', labelKey: 'mindmap.branchStraight' },
  { value: 'arrow', labelKey: 'mindmap.branchArrow' },
];
const FONT_OPTIONS: readonly { value: MapFont; labelKey: string }[] = [
  { value: 'system', labelKey: 'mindmap.fontSystem' },
  { value: 'serif', labelKey: 'mindmap.fontSerif' },
  { value: 'mono', labelKey: 'mindmap.fontMono' },
];

function isSet(key: keyof MapDisplay): boolean {
  return props.value[key] !== undefined;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const FALLBACK_TEXT_COLOR = '#000000';

function themeTextColor(): string {
  const token = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  return HEX_COLOR.test(token) ? token : FALLBACK_TEXT_COLOR;
}

const resetLabel = (): string => (props.inherited ? t('mindmap.useGlobalDefault') : t('mindmap.fieldClear'));
</script>

<template>
  <fieldset class="mm-fields" :disabled="disabled">
    <div class="mm-fields__group">
      <span :id="themeLabelId">{{ t('mindmap.fieldTheme') }}</span>
      <div class="mm-fields__themes" role="radiogroup" :aria-labelledby="themeLabelId">
        <button
          v-for="preset in MAP_THEMES"
          :key="preset.id"
          type="button"
          role="radio"
          class="mm-fields__theme"
          :aria-checked="currentTheme === preset.id"
          @click="emit('set', { theme: preset.id })"
        >
          <span class="mm-fields__theme-name">{{ t(preset.labelKey) }}</span>
          <span class="mm-fields__swatches" aria-hidden="true">
            <span v-for="color in preset[family].palette" :key="color" class="mm-fields__swatch" :style="{ background: color }" />
          </span>
        </button>
      </div>
      <button v-if="isSet('theme')" type="button" @click="emit('clear', 'theme')">{{ resetLabel() }}</button>
    </div>
    <label class="mm-fields__inline">
      <input type="checkbox" :checked="value.compact ?? inherited?.compact ?? false" @change="emit('set', { compact: ($event.target as HTMLInputElement).checked })" />
      {{ t('mindmap.fieldCompact') }}
      <button v-if="isSet('compact')" type="button" @click="emit('clear', 'compact')">{{ resetLabel() }}</button>
    </label>
    <label>{{ t('mindmap.fieldBranchStyle') }}
      <select :value="value.branchStyle ?? inherited?.branchStyle ?? 'curve'" @change="emit('set', { branchStyle: ($event.target as HTMLSelectElement).value as BranchStyle })">
        <option v-for="o in BRANCH_OPTIONS" :key="o.value" :value="o.value">{{ t(o.labelKey) }}</option>
      </select>
      <button v-if="isSet('branchStyle')" type="button" @click="emit('clear', 'branchStyle')">{{ resetLabel() }}</button>
    </label>
    <label>{{ t('mindmap.fieldFoldedCount') }}
      <select :value="value.foldedCount ?? inherited?.foldedCount ?? 'both'" @change="emit('set', { foldedCount: ($event.target as HTMLSelectElement).value as FoldedCountMode })">
        <option v-for="o in FOLDED_COUNT_OPTIONS" :key="o.value" :value="o.value">{{ t(o.labelKey) }}</option>
      </select>
      <button v-if="isSet('foldedCount')" type="button" @click="emit('clear', 'foldedCount')">{{ resetLabel() }}</button>
    </label>
    <label>{{ t('mindmap.fieldTextColor') }}
      <span class="mm-fields__row">
        <input type="color" :value="value.textColor ?? inherited?.textColor ?? themeTextColor()" @change="emit('set', { textColor: ($event.target as HTMLInputElement).value })" />
        <button v-if="isSet('textColor')" type="button" @click="emit('clear', 'textColor')">{{ resetLabel() }}</button>
      </span>
    </label>
    <label>{{ t('mindmap.fieldFont') }}
      <select :value="value.font ?? inherited?.font ?? 'system'" @change="emit('set', { font: ($event.target as HTMLSelectElement).value as MapFont })">
        <option v-for="o in FONT_OPTIONS" :key="o.value" :value="o.value">{{ t(o.labelKey) }}</option>
      </select>
      <button v-if="isSet('font')" type="button" @click="emit('clear', 'font')">{{ resetLabel() }}</button>
    </label>
  </fieldset>
</template>

<style scoped>
.mm-fields { display: flex; flex-direction: column; gap: 12px; border: 0; padding: 0; margin: 0; font-size: 12px; }
.mm-fields label { display: flex; flex-direction: column; gap: 4px; }
.mm-fields__inline { flex-direction: row !important; align-items: center; gap: 8px !important; }
.mm-fields__row { display: flex; gap: 8px; align-items: center; }
.mm-fields__group { display: flex; flex-direction: column; gap: 4px; }
.mm-fields__themes { display: flex; flex-direction: column; gap: 4px; }
.mm-fields__theme { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 4px; background: var(--bg); color: var(--text); cursor: pointer; font: inherit; }
.mm-fields__theme[aria-checked='true'] { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.mm-fields__swatches { display: flex; gap: 2px; }
.mm-fields__swatch { width: 10px; height: 10px; border-radius: 2px; }
</style>
