<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import type { Snippet, SnippetKind } from '../lib/mindmap-snippets';
import { snippetPreviewSource } from '../lib/mindmap-snippets';
import { useI18n } from '../i18n';
import Preview from './Preview.vue';

const CONFIRM_WINDOW_MS = 3000;
const KIND_LABEL_KEYS: Record<SnippetKind, string> = { md: 'mindmap.snippetKindMd', mermaid: 'mindmap.snippetKindMermaid', mmap: 'mindmap.snippetKindMmap' };

const props = defineProps<{ snippet: Snippet; editable: boolean; isFirst: boolean; isLast: boolean }>();
const emit = defineEmits<{ update: [next: Snippet]; remove: []; move: [delta: -1 | 1] }>();
const { t } = useI18n();
const isEditing = ref(false);
const isConfirmingDelete = ref(false);
let confirmTimer: number | null = null;
const previewSource = computed(() => snippetPreviewSource(props.snippet));

function patch(fields: Partial<Pick<Snippet, 'title' | 'body'>>): void {
  emit('update', { ...props.snippet, ...fields });
}

function onInput(field: 'title' | 'body', e: Event): void {
  patch({ [field]: (e.target as HTMLInputElement | HTMLTextAreaElement).value });
}

function clearConfirmTimer(): void {
  if (confirmTimer === null) return;
  window.clearTimeout(confirmTimer);
  confirmTimer = null;
}

function requestDelete(): void {
  if (isConfirmingDelete.value) {
    emit('remove');
    return;
  }
  isConfirmingDelete.value = true;
  clearConfirmTimer();
  confirmTimer = window.setTimeout(() => { isConfirmingDelete.value = false; }, CONFIRM_WINDOW_MS);
}

function stopEditing(): void {
  isEditing.value = false;
  isConfirmingDelete.value = false;
  clearConfirmTimer();
}

onBeforeUnmount(clearConfirmTimer);
</script>

<template>
  <article class="mm-snippet" :data-kind="snippet.kind">
    <header class="mm-snippet__head">
      <span class="mm-snippet__kind">{{ t(KIND_LABEL_KEYS[snippet.kind]) }}</span>
      <input
        v-if="isEditing && editable"
        class="mm-snippet__title-input"
        dir="auto"
        :aria-label="t('mindmap.snippetTitleLabel')"
        :value="snippet.title"
        @input="onInput('title', $event)"
      />
      <h4 v-else class="mm-snippet__title" dir="auto">{{ snippet.title || snippet.id }}</h4>
      <div v-if="editable" class="mm-snippet__actions">
        <button type="button" :disabled="isFirst" :aria-label="t('mindmap.snippetMoveUp')" :title="t('mindmap.snippetMoveUp')" @click="emit('move', -1)">↑</button>
        <button type="button" :disabled="isLast" :aria-label="t('mindmap.snippetMoveDown')" :title="t('mindmap.snippetMoveDown')" @click="emit('move', 1)">↓</button>
        <button type="button" @click="isEditing ? stopEditing() : (isEditing = true)">{{ t(isEditing ? 'mindmap.snippetDone' : 'mindmap.snippetEdit') }}</button>
        <button type="button" @click="requestDelete">{{ t(isConfirmingDelete ? 'mindmap.snippetDeleteConfirm' : 'mindmap.snippetDelete') }}</button>
      </div>
    </header>
    <textarea
      v-if="isEditing && editable"
      class="mm-snippet__body"
      dir="auto"
      spellcheck="false"
      :aria-label="t('mindmap.snippetBodyLabel')"
      :value="snippet.body"
      @input="onInput('body', $event)"
      @keydown.esc.stop="stopEditing"
    />
    <Preview v-else :source="previewSource" class="mm-snippet__preview" />
  </article>
</template>

<style scoped>
.mm-snippet { border: 1px solid var(--border); border-radius: 6px; background: var(--bg); }
.mm-snippet__head { display: flex; align-items: center; gap: 8px; padding-block: 4px; padding-inline: 8px; border-block-end: 1px solid var(--border); }
.mm-snippet__kind { font-size: 11px; padding-inline: 6px; border-radius: 999px; border: 1px solid var(--accent); color: var(--text); }
.mm-snippet__title { flex: 1; margin: 0; font-size: 13px; unicode-bidi: plaintext; text-align: start; color: var(--text); }
.mm-snippet__title-input { flex: 1; font-size: 13px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); }
.mm-snippet__actions { display: flex; gap: 4px; }
.mm-snippet__actions button { font-size: 12px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; }
.mm-snippet__body { display: block; width: 100%; min-height: 8em; box-sizing: border-box; font-family: var(--font-mono, monospace); font-size: 13px; background: var(--bg-elev); color: var(--text); border: 0; padding: 8px; resize: vertical; unicode-bidi: plaintext; }
.mm-snippet__preview { max-height: 420px; overflow: auto; }
</style>
