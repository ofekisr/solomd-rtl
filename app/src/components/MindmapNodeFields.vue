<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { NodeObj } from 'mind-elixir';
import { useI18n } from '../i18n';
import { FONT_SIZE_MAX, FONT_SIZE_MIN, NODE_ICONS, isSafeLink, toggleIcon, type NodeField } from '../lib/mindmap-node-style';

const DEFAULT_FONT_SIZE = 16;
const props = defineProps<{ node: NodeObj; disabled: boolean }>();
const emit = defineEmits<{ patch: [field: NodeField, value: string | number | boolean | readonly string[] | null] }>();
const { t } = useI18n();

const url = ref('');
const isUrlInvalid = computed(() => url.value !== '' && !isSafeLink(url.value));
const fontSize = computed(() => Number.parseInt(props.node.style?.fontSize ?? '', 10) || DEFAULT_FONT_SIZE);
watch(() => props.node, (node) => { url.value = node.hyperLink ?? ''; }, { immediate: true });

function commitUrl(): void {
  if (!isUrlInvalid.value) emit('patch', 'hyperLink', url.value);
}

function onIcon(icon: string): void {
  emit('patch', 'icons', toggleIcon(props.node.icons, icon));
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const FALLBACK_TEXT_COLOR = '#000000';

function themeTextColor(): string {
  const token = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  return HEX_COLOR.test(token) ? token : FALLBACK_TEXT_COLOR;
}

function tagText(): string {
  return (props.node.tags ?? []).map((tag) => (typeof tag === 'string' ? tag : tag.text)).join(', ');
}
</script>

<template>
  <fieldset class="mm-fields" :disabled="disabled">
    <label>{{ t('mindmap.fieldTextColor') }}
      <span class="mm-fields__row">
        <input type="color" :value="node.style?.color || themeTextColor()" @change="emit('patch', 'color', ($event.target as HTMLInputElement).value)" />
        <button type="button" @click="emit('patch', 'color', null)">{{ t('mindmap.fieldClear') }}</button>
      </span>
    </label>
    <label>{{ t('mindmap.fieldBackground') }}
      <span class="mm-fields__row">
        <input type="color" :value="node.style?.background || '#ffffff'" @change="emit('patch', 'background', ($event.target as HTMLInputElement).value)" />
        <button type="button" @click="emit('patch', 'background', null)">{{ t('mindmap.fieldClear') }}</button>
      </span>
    </label>
    <label>{{ t('mindmap.fieldFontSize') }} — {{ fontSize }}px
      <input type="range" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" :value="fontSize" @change="emit('patch', 'fontSize', Number(($event.target as HTMLInputElement).value))" />
    </label>
    <label class="mm-fields__inline">
      <input type="checkbox" :checked="node.style?.fontWeight === 'bold'" @change="emit('patch', 'bold', ($event.target as HTMLInputElement).checked)" />
      {{ t('mindmap.fieldBold') }}
    </label>
    <label>{{ t('mindmap.fieldBranchColor') }}
      <span class="mm-fields__row">
        <input type="color" :value="node.branchColor ?? '#888888'" @change="emit('patch', 'branchColor', ($event.target as HTMLInputElement).value)" />
        <button type="button" @click="emit('patch', 'branchColor', null)">{{ t('mindmap.fieldClear') }}</button>
      </span>
    </label>
    <label>{{ t('mindmap.fieldTags') }}
      <input type="text" dir="auto" :value="tagText()" :placeholder="t('mindmap.fieldTagsHint')" @change="emit('patch', 'tags', ($event.target as HTMLInputElement).value)" />
    </label>
    <div>{{ t('mindmap.fieldIcons') }}
      <div class="mm-fields__icons">
        <button v-for="icon in NODE_ICONS" :key="icon" type="button" :aria-pressed="node.icons?.includes(icon) ?? false" @click="onIcon(icon)">{{ icon }}</button>
      </div>
    </div>
    <label>{{ t('mindmap.fieldUrl') }}
      <input v-model="url" type="url" dir="ltr" :aria-invalid="isUrlInvalid" @change="commitUrl" />
      <small v-if="isUrlInvalid" role="alert">{{ t('mindmap.fieldUrlInvalid') }}</small>
    </label>
    <label>{{ t('mindmap.fieldNote') }}
      <textarea rows="6" dir="auto" :value="node.note ?? ''" @change="emit('patch', 'note', ($event.target as HTMLTextAreaElement).value)" />
    </label>
  </fieldset>
</template>

<style scoped>
.mm-fields { display: flex; flex-direction: column; gap: 12px; border: 0; padding: 0; margin: 0; font-size: 12px; }
.mm-fields label { display: flex; flex-direction: column; gap: 4px; }
.mm-fields__inline { flex-direction: row !important; align-items: center; }
.mm-fields__row { display: flex; gap: 8px; align-items: center; }
.mm-fields__icons { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-block-start: 4px; }
.mm-fields__icons button { padding: 4px; border: 1px solid transparent; border-radius: 4px; background: transparent; cursor: pointer; }
.mm-fields__icons button[aria-pressed='true'] { border-color: var(--accent, #4a7); }
.mm-fields input[type='text'], .mm-fields input[type='url'], .mm-fields textarea { width: 100%; box-sizing: border-box; }
</style>
