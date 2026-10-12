<script setup lang="ts">
import { ref } from 'vue';
import { createSnippet, SNIPPET_KINDS, type Snippet, type SnippetKind } from '../lib/mindmap-snippets';
import { useI18n } from '../i18n';
import MindmapSnippetCard from './MindmapSnippetCard.vue';

const ADD_LABEL_KEYS: Record<SnippetKind, string> = { md: 'mindmap.snippetAddMd', mermaid: 'mindmap.snippetAddMermaid', mmap: 'mindmap.snippetAddMmap' };

const props = defineProps<{ snippets: readonly Snippet[]; editable: boolean }>();
const emit = defineEmits<{ change: [next: Snippet[]] }>();
const { t } = useI18n();
const isCollapsed = ref(false);

function add(kind: SnippetKind): void {
  emit('change', [...props.snippets, createSnippet(kind, props.snippets, t('mindmap.snippetUntitled'))]);
}

function update(index: number, next: Snippet): void {
  emit('change', props.snippets.map((s, i) => (i === index ? next : s)));
}

function remove(index: number): void {
  emit('change', props.snippets.filter((_, i) => i !== index));
}

function move(index: number, delta: -1 | 1): void {
  const next = [...props.snippets];
  const [item] = next.splice(index, 1);
  next.splice(index + delta, 0, item);
  emit('change', next);
}
</script>

<template>
  <section v-if="snippets.length > 0 || editable" class="mm-snippets" :aria-label="t('mindmap.snippetsTitle')">
    <header class="mm-snippets__head">
      <button type="button" class="mm-snippets__toggle" :aria-expanded="!isCollapsed" @click="isCollapsed = !isCollapsed">
        {{ isCollapsed ? '▸' : '▾' }} {{ t('mindmap.snippetsTitle') }} ({{ snippets.length }})
      </button>
      <div v-if="editable && !isCollapsed" class="mm-snippets__add">
        <button v-for="kind in SNIPPET_KINDS" :key="kind" type="button" @click="add(kind)">{{ t(ADD_LABEL_KEYS[kind]) }}</button>
      </div>
    </header>
    <div v-if="!isCollapsed" class="mm-snippets__list">
      <p v-if="snippets.length === 0" class="mm-snippets__empty">{{ t('mindmap.snippetsEmpty') }}</p>
      <MindmapSnippetCard
        v-for="(snippet, index) in snippets"
        :key="snippet.id"
        :snippet="snippet"
        :editable="editable"
        :is-first="index === 0"
        :is-last="index === snippets.length - 1"
        @update="(next) => update(index, next)"
        @remove="remove(index)"
        @move="(delta) => move(index, delta)"
      />
    </div>
  </section>
</template>

<style scoped>
.mm-snippets { display: flex; flex-direction: column; max-height: 45%; min-height: 0; border-block-start: 1px solid var(--border); background: var(--bg-elev); }
.mm-snippets__head { display: flex; align-items: center; gap: 8px; padding-block: 4px; padding-inline: 8px; }
.mm-snippets__toggle { background: none; border: 0; color: var(--text); cursor: pointer; font-size: 13px; }
.mm-snippets__add { display: flex; gap: 4px; margin-inline-start: auto; }
.mm-snippets__add button { font-size: 12px; background: var(--bg); color: var(--text); border: 1px solid var(--border); border-radius: 4px; cursor: pointer; }
.mm-snippets__list { overflow: auto; display: flex; flex-direction: column; gap: 8px; padding: 8px; }
.mm-snippets__empty { margin: 0; font-size: 12px; color: var(--text-faint); }
</style>
