<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { NodeObj } from 'mind-elixir';
import { openerPort } from '../platform/index.ts';
import { useI18n } from '../i18n';
import { useToastsStore } from '../stores/toasts';
import { copyPlainText } from '../lib/code-copy';
import { CLAUDE_SESSION_KEY, fieldAction, nodePath, readFields, type FieldAction, type NodeFieldEntry } from '../lib/mindmap-node-fields';
import MindmapNoteEditor from './MindmapNoteEditor.vue';

const NOTE_COMMIT_DELAY_MS = 500;
const HEIGHT_MIN_PX = 120;
const HEIGHT_MAX_RATIO = 0.7;

const props = defineProps<{ node: NodeObj | null; disabled: boolean; height: number }>();
const emit = defineEmits<{
  note: [nodeId: string, text: string];
  fields: [nodeId: string, entries: NodeFieldEntry[]];
  resize: [height: number];
  close: [];
}>();
const { t } = useI18n();
const toasts = useToastsStore();

const path = computed(() => (props.node ? nodePath(props.node) : []));
const rows = ref<NodeFieldEntry[]>([]);
let pendingNote: { nodeId: string; text: string } | null = null;
let noteTimer: number | null = null;

const storedFields = computed(() => (props.node ? readFields(props.node) : []));

watch(() => props.node?.id, () => { rows.value = storedFields.value; }, { immediate: true });
watch(() => JSON.stringify(storedFields.value), (stored) => {
  if (stored !== JSON.stringify(namedRows(rows.value))) rows.value = storedFields.value;
});

function namedRows(entries: readonly NodeFieldEntry[]): NodeFieldEntry[] {
  return entries.filter((row) => row.key.trim() !== '');
}
watch(() => props.node?.id, flushNote);

function flushNote(): void {
  if (noteTimer !== null) window.clearTimeout(noteTimer);
  noteTimer = null;
  if (pendingNote) emit('note', pendingNote.nodeId, pendingNote.text);
  pendingNote = null;
}

function onNoteInput(text: string): void {
  if (!props.node) return;
  pendingNote = { nodeId: props.node.id, text };
  if (noteTimer !== null) window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(flushNote, NOTE_COMMIT_DELAY_MS);
}

function commitRows(next: NodeFieldEntry[]): void {
  rows.value = next;
  if (props.node) emit('fields', props.node.id, namedRows(next));
}

function editRow(index: number, part: keyof NodeFieldEntry, value: string): void {
  commitRows(rows.value.map((row, i) => (i === index ? { ...row, [part]: value } : row)));
}

function addRow(key = ''): void {
  rows.value = [...rows.value, { key, value: '' }];
}

function removeRow(index: number): void {
  commitRows(rows.value.filter((_, i) => i !== index));
}

async function runAction(action: FieldAction): Promise<void> {
  if (action.kind === 'link') await openerPort.openUrl(action.url).catch(() => toasts.error(t('mindmap.detailsOpenFailed')));
  if (action.kind !== 'claudeResume') return;
  await copyPlainText(action.command);
  toasts.info(t('mindmap.detailsResumeCopied'));
}

function actionLabel(action: FieldAction): string {
  return action.kind === 'claudeResume' ? t('mindmap.detailsCopyResume') : t('mindmap.detailsOpenLink');
}

function startResize(down: PointerEvent): void {
  const startY = down.clientY;
  const startHeight = props.height;
  const maxHeight = window.innerHeight * HEIGHT_MAX_RATIO;
  const onMove = (move: PointerEvent): void => {
    emit('resize', Math.round(Math.min(maxHeight, Math.max(HEIGHT_MIN_PX, startHeight + startY - move.clientY))));
  };
  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}

onBeforeUnmount(flushNote);
</script>

<template>
  <section class="mm-details" :style="{ height: `${height}px` }" :aria-label="t('mindmap.detailsTitle')">
    <div class="mm-details__grip" role="separator" aria-orientation="horizontal" @pointerdown.prevent="startResize" />
    <header class="mm-details__head">
      <nav v-if="node" class="mm-details__crumbs" dir="auto">
        <span v-for="(topic, i) in path" :key="i" class="mm-details__crumb">{{ topic }} ›</span>
        <strong>{{ node.topic }}</strong>
      </nav>
      <span v-else class="mm-details__hint">{{ t('mindmap.panelSelectOne') }}</span>
      <button type="button" class="mm-details__close" :aria-label="t('mindmap.detailsClose')" :title="t('mindmap.detailsClose')" @click="emit('close')">×</button>
    </header>
    <div v-if="node" class="mm-details__body">
      <MindmapNoteEditor
        class="mm-details__note"
        :value="node.note ?? ''"
        :doc-key="node.id"
        :disabled="disabled"
        :placeholder="t('mindmap.detailsNotePlaceholder')"
        @input="onNoteInput"
        @blur="flushNote"
      />
      <fieldset class="mm-details__fields" :disabled="disabled">
        <legend>{{ t('mindmap.detailsFields') }}</legend>
        <div v-for="(row, i) in rows" :key="i" class="mm-details__row">
          <input :value="row.key" dir="auto" :placeholder="t('mindmap.detailsKey')" @change="editRow(i, 'key', ($event.target as HTMLInputElement).value)" />
          <input :value="row.value" dir="auto" :placeholder="t('mindmap.detailsValue')" @change="editRow(i, 'value', ($event.target as HTMLInputElement).value)" />
          <button v-if="fieldAction(row).kind !== 'none'" type="button" :title="actionLabel(fieldAction(row))" @click="runAction(fieldAction(row))">{{ fieldAction(row).kind === 'link' ? '↗' : '⧉' }}</button>
          <button type="button" :title="t('mindmap.detailsRemove')" @click="removeRow(i)">−</button>
        </div>
        <div class="mm-details__add">
          <button type="button" @click="addRow()">+ {{ t('mindmap.detailsAddField') }}</button>
          <button type="button" @click="addRow(CLAUDE_SESSION_KEY)">+ {{ t('mindmap.detailsBindClaude') }}</button>
        </div>
      </fieldset>
    </div>
  </section>
</template>

<style scoped>
.mm-details { position: relative; flex: 0 0 auto; display: flex; flex-direction: column; min-height: 0; border-block-start: 1px solid var(--border); background: var(--bg-elev); color: var(--text); font-size: 12px; }
.mm-details__grip { position: absolute; inset-inline: 0; inset-block-start: -3px; height: 6px; cursor: row-resize; z-index: 1; }
.mm-details__head { display: flex; align-items: center; gap: 8px; padding: 4px 8px 4px 12px; border-block-end: 1px solid var(--border); }
.mm-details__crumbs { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.mm-details__crumb { color: var(--text-faint); margin-inline-end: 4px; }
.mm-details__hint { flex: 1; color: var(--text-faint); }
.mm-details__close { border: 0; background: transparent; color: inherit; cursor: pointer; font-size: 16px; line-height: 1; }
.mm-details__body { flex: 1; min-height: 0; display: flex; }
.mm-details__note { flex: 1; min-width: 0; background: var(--bg); }
.mm-details__fields { flex: 0 0 300px; display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 8px; border: 0; border-inline-start: 1px solid var(--border); overflow: auto; }
.mm-details__fields legend { padding: 0; margin-block-end: 4px; color: var(--text-faint); }
.mm-details__row { display: grid; grid-template-columns: 90px 1fr auto auto; gap: 4px; }
.mm-details__row input { min-width: 0; }
.mm-details__row button, .mm-details__add button { border: 1px solid var(--border); border-radius: 4px; background: transparent; color: inherit; cursor: pointer; padding: 2px 6px; }
.mm-details__add { display: flex; gap: 4px; flex-wrap: wrap; margin-block-start: 4px; }
</style>
