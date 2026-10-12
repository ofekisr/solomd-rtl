<script setup lang="ts">
import { useI18n } from '../i18n';
import type { DuplicateGroup } from '../lib/mindmap-duplicates';

defineProps<{ groups: DuplicateGroup[]; topicOf: (id: string) => string }>();
const emit = defineEmits<{ merge: [keepId: string, dupId: string]; close: [] }>();
const { t } = useI18n();
</script>

<template>
  <div class="mindmap-dups" role="dialog" :aria-label="t('mindmap.duplicatesTitle')" @keydown.escape.stop="emit('close')">
    <header>
      <h3>{{ t('mindmap.duplicatesTitle') }}</h3>
      <button type="button" @click="emit('close')">{{ t('mindmap.close') }}</button>
    </header>
    <p v-if="groups.length === 0">{{ t('mindmap.duplicatesEmpty') }}</p>
    <ul v-else>
      <li v-for="group in groups" :key="group.key">
        <strong>{{ topicOf(group.ids[0]) }}</strong> × {{ group.ids.length }}
        <button v-for="dupId in group.ids.slice(1)" :key="dupId" type="button" @click="emit('merge', group.ids[0], dupId)">
          {{ t('mindmap.mergeIntoGate') }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.mindmap-dups { position: absolute; inset-block-start: 40px; inset-inline-end: 16px; max-height: 60%; overflow: auto; padding: 12px 16px; border-radius: 8px; background: var(--bg-primary, #fff); box-shadow: 0 4px 16px rgb(0 0 0 / 0.2); z-index: 10; unicode-bidi: plaintext; }
.mindmap-dups header { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.mindmap-dups li { display: flex; gap: 8px; align-items: center; padding-block: 4px; }
</style>
