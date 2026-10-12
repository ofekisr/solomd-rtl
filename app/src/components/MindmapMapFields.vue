<script setup lang="ts">
import { useI18n } from '../i18n';
import type { BranchStyle, MapDisplay, MapFont } from '../lib/mindmap-display';

const props = defineProps<{ value: MapDisplay; inherited?: MapDisplay; disabled?: boolean }>();
const emit = defineEmits<{ set: [patch: MapDisplay]; clear: [key: keyof MapDisplay] }>();
const { t } = useI18n();

const BRANCH_OPTIONS: readonly { value: BranchStyle; labelKey: string }[] = [
  { value: 'curve', labelKey: 'mindmap.branchCurve' },
  { value: 'straight', labelKey: 'mindmap.branchStraight' },
];
const FONT_OPTIONS: readonly { value: MapFont; labelKey: string }[] = [
  { value: 'system', labelKey: 'mindmap.fontSystem' },
  { value: 'serif', labelKey: 'mindmap.fontSerif' },
  { value: 'mono', labelKey: 'mindmap.fontMono' },
];

function isSet(key: keyof MapDisplay): boolean {
  return props.value[key] !== undefined;
}

const resetLabel = (): string => (props.inherited ? t('mindmap.useGlobalDefault') : t('mindmap.fieldClear'));
</script>

<template>
  <fieldset class="mm-fields" :disabled="disabled">
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
    <label>{{ t('mindmap.fieldTextColor') }}
      <span class="mm-fields__row">
        <input type="color" :value="value.textColor ?? inherited?.textColor ?? '#000000'" @change="emit('set', { textColor: ($event.target as HTMLInputElement).value })" />
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
</style>
