<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { NodeObj } from 'mind-elixir';
import { useI18n } from '../i18n';
import {
  BORDER_WIDTH_MAX, FONT_SIZE_MAX, FONT_SIZE_MIN, NODE_BORDER_STYLES, NODE_DECORATIONS, NODE_ICONS, NODE_SHAPES, NODE_WIDTH_MAX, NODE_WIDTH_MIN,
  fontKeyOf, formatBorder, isSafeLink, parseBorder, shapeKeyOf, type NodeBorder, type NodeField,
} from '../lib/mindmap-node-style';

const DEFAULT_FONT_SIZE = 16;
const DEFAULT_BORDER: NodeBorder = { width: 1, style: 'solid', color: '#888888' };
const FONT_OPTIONS: readonly { value: string; labelKey: string }[] = [
  { value: 'system', labelKey: 'mindmap.fontSystem' },
  { value: 'serif', labelKey: 'mindmap.fontSerif' },
  { value: 'mono', labelKey: 'mindmap.fontMono' },
];
const DECORATION_LABELS: Readonly<Record<string, string>> = { underline: 'mindmap.decorationUnderline', 'line-through': 'mindmap.decorationStrike' };
const SHAPE_LABELS: Readonly<Record<string, string>> = { square: 'mindmap.shapeSquare', rounded: 'mindmap.shapeRounded', pill: 'mindmap.shapePill', circle: 'mindmap.shapeCircle' };
const BORDER_LABELS: Readonly<Record<string, string>> = { solid: 'mindmap.borderSolid', dashed: 'mindmap.borderDashed', dotted: 'mindmap.borderDotted', double: 'mindmap.borderDouble' };

type StyleWithRadius = NonNullable<NodeObj['style']> & { borderRadius?: string };
const props = defineProps<{ nodes: readonly NodeObj[]; disabled: boolean }>();
const emit = defineEmits<{
  patch: [field: NodeField, value: string | number | boolean | readonly string[] | null];
  icon: [icon: string, isOn: boolean];
}>();
const { t } = useI18n();

const node = computed(() => props.nodes[0]);
const style = computed<StyleWithRadius>(() => node.value.style ?? {});
const isBatch = computed(() => props.nodes.length > 1);
const url = ref('');
const isUrlInvalid = computed(() => url.value !== '' && !isSafeLink(url.value));
const fontSize = computed(() => Number.parseInt(style.value.fontSize ?? '', 10) || DEFAULT_FONT_SIZE);
const width = computed(() => Number.parseInt(style.value.width ?? '', 10) || null);
const border = computed(() => parseBorder(style.value.border));
const hasTopLevel = computed(() => props.nodes.some((n) => n.parent !== undefined && n.parent.parent === undefined));
watch(node, (n) => { url.value = n.hyperLink ?? ''; }, { immediate: true });

function commitUrl(): void {
  if (!isUrlInvalid.value) emit('patch', 'hyperLink', url.value);
}

function onIcon(icon: string): void {
  emit('icon', icon, !(node.value.icons?.includes(icon) ?? false));
}

function onWidth(raw: string): void {
  emit('patch', 'width', raw === '' ? null : Number(raw));
}

function onBorder(change: Partial<NodeBorder>): void {
  const next = { ...(border.value ?? DEFAULT_BORDER), ...change };
  emit('patch', 'border', formatBorder(next));
}

function onBorderStyle(value: string): void {
  if (value === '') emit('patch', 'border', null);
  else onBorder({ style: value });
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const FALLBACK_TEXT_COLOR = '#000000';

function themeTextColor(): string {
  const token = getComputedStyle(document.documentElement).getPropertyValue('--text').trim();
  return HEX_COLOR.test(token) ? token : FALLBACK_TEXT_COLOR;
}

function tagText(): string {
  return (node.value.tags ?? []).map((tag) => (typeof tag === 'string' ? tag : tag.text)).join(', ');
}

function selectValue(event: Event): string {
  return (event.target as HTMLSelectElement).value;
}

function inputValue(event: Event): string {
  return (event.target as HTMLInputElement).value;
}
</script>

<template>
  <fieldset class="mm-fields" :disabled="disabled">
    <p v-if="isBatch" class="mm-fields__batch" role="status">{{ t('mindmap.panelBatch', { count: nodes.length }) }}</p>
    <label>{{ t('mindmap.fieldTextColor') }}
      <span class="mm-fields__row">
        <input type="color" :value="style.color || themeTextColor()" @change="emit('patch', 'color', inputValue($event))" />
        <button type="button" @click="emit('patch', 'color', null)">{{ t('mindmap.fieldClear') }}</button>
      </span>
    </label>
    <label>{{ t('mindmap.fieldBackground') }}
      <span class="mm-fields__row">
        <input type="color" :value="style.background || '#ffffff'" @change="emit('patch', 'background', inputValue($event))" />
        <button type="button" @click="emit('patch', 'background', null)">{{ t('mindmap.fieldClear') }}</button>
      </span>
    </label>
    <label>{{ t('mindmap.fieldFontSize') }} — {{ fontSize }}px
      <input type="range" :min="FONT_SIZE_MIN" :max="FONT_SIZE_MAX" :value="fontSize" @change="emit('patch', 'fontSize', Number(inputValue($event)))" />
    </label>
    <label>{{ t('mindmap.fieldFont') }}
      <select :value="fontKeyOf(style.fontFamily)" @change="emit('patch', 'fontFamily', selectValue($event))">
        <option value="">{{ t('mindmap.fieldInherit') }}</option>
        <option v-for="opt in FONT_OPTIONS" :key="opt.value" :value="opt.value">{{ t(opt.labelKey) }}</option>
      </select>
    </label>
    <span class="mm-fields__row">
      <label class="mm-fields__inline">
        <input type="checkbox" :checked="style.fontWeight === 'bold'" @change="emit('patch', 'bold', ($event.target as HTMLInputElement).checked)" />
        {{ t('mindmap.fieldBold') }}
      </label>
      <select :aria-label="t('mindmap.fieldDecoration')" :value="style.textDecoration ?? ''" @change="emit('patch', 'textDecoration', selectValue($event))">
        <option value="">{{ t('mindmap.decorationNone') }}</option>
        <option v-for="d in NODE_DECORATIONS" :key="d" :value="d">{{ t(DECORATION_LABELS[d]) }}</option>
      </select>
    </span>
    <label>{{ t('mindmap.fieldShape') }}
      <select :value="shapeKeyOf(style.borderRadius)" @change="emit('patch', 'shape', selectValue($event))">
        <option value="">{{ t('mindmap.fieldInherit') }}</option>
        <option v-for="(_, key) in NODE_SHAPES" :key="key" :value="key">{{ t(SHAPE_LABELS[key]) }}</option>
      </select>
    </label>
    <label>{{ t('mindmap.fieldBorder') }}
      <span class="mm-fields__row">
        <select :value="border?.style ?? ''" @change="onBorderStyle(selectValue($event))">
          <option value="">{{ t('mindmap.borderNone') }}</option>
          <option v-for="s in NODE_BORDER_STYLES" :key="s" :value="s">{{ t(BORDER_LABELS[s]) }}</option>
        </select>
        <template v-if="border">
          <input class="mm-fields__num" type="number" min="1" :max="BORDER_WIDTH_MAX" :value="border.width" :aria-label="t('mindmap.fieldBorderWidth')" @change="onBorder({ width: Number(inputValue($event)) })" />
          <input type="color" :value="HEX_COLOR.test(border.color) ? border.color : DEFAULT_BORDER.color" :aria-label="t('mindmap.fieldBorderColor')" @change="onBorder({ color: inputValue($event) })" />
        </template>
      </span>
      <small v-if="border && hasTopLevel">{{ t('mindmap.fieldBorderTopLevel') }}</small>
    </label>
    <label>{{ t('mindmap.fieldWidth') }}
      <span class="mm-fields__row">
        <input class="mm-fields__num" type="number" :min="NODE_WIDTH_MIN" :max="NODE_WIDTH_MAX" step="10" :value="width ?? ''" :placeholder="t('mindmap.fieldWidthAuto')" @change="onWidth(inputValue($event))" />
        <button type="button" @click="emit('patch', 'width', null)">{{ t('mindmap.fieldClear') }}</button>
      </span>
    </label>
    <label>{{ t('mindmap.fieldBranchColor') }}
      <span class="mm-fields__row">
        <input type="color" :value="node.branchColor ?? '#888888'" @change="emit('patch', 'branchColor', inputValue($event))" />
        <button type="button" @click="emit('patch', 'branchColor', null)">{{ t('mindmap.fieldClear') }}</button>
      </span>
    </label>
    <label>{{ t('mindmap.fieldTags') }}
      <input type="text" dir="auto" :value="tagText()" :placeholder="t('mindmap.fieldTagsHint')" @change="emit('patch', 'tags', inputValue($event))" />
    </label>
    <div>{{ t('mindmap.fieldIcons') }}
      <div class="mm-fields__icons">
        <button v-for="icon in NODE_ICONS" :key="icon" type="button" :aria-pressed="node.icons?.includes(icon) ?? false" @click="onIcon(icon)">{{ icon }}</button>
      </div>
    </div>
    <template v-if="!isBatch">
      <label>{{ t('mindmap.fieldUrl') }}
        <input v-model="url" type="url" dir="ltr" :aria-invalid="isUrlInvalid" @change="commitUrl" />
        <small v-if="isUrlInvalid" role="alert">{{ t('mindmap.fieldUrlInvalid') }}</small>
      </label>
      <label>{{ t('mindmap.fieldNote') }}
        <textarea rows="6" dir="auto" :value="node.note ?? ''" @change="emit('patch', 'note', ($event.target as HTMLTextAreaElement).value)" />
      </label>
    </template>
  </fieldset>
</template>

<style scoped>
.mm-fields { display: flex; flex-direction: column; gap: 12px; border: 0; padding: 0; margin: 0; font-size: 12px; }
.mm-fields label { display: flex; flex-direction: column; gap: 4px; }
.mm-fields__inline { flex-direction: row !important; align-items: center; }
.mm-fields__row { display: flex; gap: 8px; align-items: center; }
.mm-fields__num { width: 64px; }
.mm-fields__batch { margin: 0; padding: 6px 8px; border-radius: 4px; background: var(--bg); border: 1px solid var(--accent, #4a7); }
.mm-fields__icons { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; margin-block-start: 4px; }
.mm-fields__icons button { padding: 4px; border: 1px solid transparent; border-radius: 4px; background: transparent; cursor: pointer; }
.mm-fields__icons button[aria-pressed='true'] { border-color: var(--accent, #4a7); }
.mm-fields input[type='text'], .mm-fields input[type='url'], .mm-fields textarea { width: 100%; box-sizing: border-box; }
</style>
