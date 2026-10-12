<script setup lang="ts">
import { ref, watch } from 'vue';
import { useI18n } from '../i18n';

type PanelTab = 'node' | 'map';
const props = defineProps<{ hasSingleNode: boolean; hasMultipleNodes: boolean }>();
const { t } = useI18n();
const active = ref<PanelTab>(props.hasSingleNode ? 'node' : 'map');
watch(() => props.hasSingleNode, (isSingle) => { active.value = isSingle ? 'node' : 'map'; });
</script>

<template>
  <aside class="mm-panel">
    <div class="mm-panel__tabs" role="tablist">
      <button type="button" role="tab" :aria-selected="active === 'node'" @click="active = 'node'">{{ t('mindmap.panelNode') }}</button>
      <button type="button" role="tab" :aria-selected="active === 'map'" @click="active = 'map'">{{ t('mindmap.panelMap') }}</button>
    </div>
    <div class="mm-panel__body">
      <template v-if="active === 'node'">
        <slot v-if="hasSingleNode" name="node" />
        <p v-else class="mm-panel__hint">{{ t('mindmap.panelSelectOne') }}</p>
      </template>
      <slot v-else name="map" />
    </div>
  </aside>
</template>

<style scoped>
.mm-panel { width: 260px; flex: 0 0 260px !important; display: flex; flex-direction: column; border-inline-start: 1px solid var(--border); background: var(--bg-elev); color: var(--text); overflow: auto; }
.mm-panel__tabs { display: flex; gap: 2px; padding: 6px; }
.mm-panel__tabs button { flex: 1; padding: 4px; border: 1px solid transparent; border-radius: 4px; background: transparent; color: inherit; cursor: pointer; }
.mm-panel__tabs button[aria-selected='true'] { border-color: var(--border); background: var(--bg); }
.mm-panel__body { padding: 8px 12px; }
.mm-panel__hint { color: var(--text-faint); font-size: 12px; }
</style>
