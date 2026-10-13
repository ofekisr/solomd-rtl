<script setup lang="ts">
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { bidiExtension } from '../lib/cm-bidi';
import { liveEditExtension } from '../lib/cm-live-render';
import { createLanguageExtension } from '../lib/editor-language';

const props = defineProps<{ value: string; docKey: string; disabled: boolean; placeholder: string }>();
const emit = defineEmits<{ input: [text: string]; blur: [] }>();
const host = ref<HTMLDivElement | null>(null);
const editable = new Compartment();
let view: EditorView | null = null;

function editableExtension(isDisabled: boolean): Extension {
  return [EditorView.editable.of(!isDisabled), EditorState.readOnly.of(isDisabled)];
}

function buildState(doc: string): EditorState {
  return EditorState.create({
    doc,
    extensions: [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      createLanguageExtension('markdown'),
      liveEditExtension(),
      bidiExtension(),
      EditorView.lineWrapping,
      placeholder(props.placeholder),
      editable.of(editableExtension(props.disabled)),
      EditorView.updateListener.of((update) => { if (update.docChanged) emit('input', update.state.doc.toString()); }),
      EditorView.domEventHandlers({ blur: () => { emit('blur'); } }),
    ],
  });
}

function replaceDoc(doc: string): void {
  if (!view || view.state.doc.toString() === doc) return;
  view.setState(buildState(doc));
}

watch(() => props.docKey, () => replaceDoc(props.value));
watch(() => props.value, (next) => { if (!view?.hasFocus) replaceDoc(next); });
watch(() => props.disabled, (isDisabled) => view?.dispatch({ effects: editable.reconfigure(editableExtension(isDisabled)) }));

onMounted(() => {
  if (host.value) view = new EditorView({ state: buildState(props.value), parent: host.value });
});
onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});
</script>

<template>
  <div ref="host" class="mm-note-editor" />
</template>

<style scoped>
.mm-note-editor { height: 100%; min-height: 0; overflow: auto; }
.mm-note-editor :deep(.cm-editor) { height: 100%; background: transparent; }
.mm-note-editor :deep(.cm-editor.cm-focused) { outline: none; }
.mm-note-editor :deep(.cm-content) { padding: 8px 12px; }
</style>
