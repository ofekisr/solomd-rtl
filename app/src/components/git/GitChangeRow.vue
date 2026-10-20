<script setup lang="ts">
import { computed } from 'vue';
import type { WireWorkingTreeFile } from '../../lib/git-pane/shared/models';
import { statusLetter } from '../../lib/git-pane/statusLetter';
import { useI18n } from '../../i18n';

const props = defineProps<{ file: WireWorkingTreeFile; included: boolean; isStaged: boolean }>();
const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'open-diff'): void;
  (e: 'open-file'): void;
  (e: 'context', ev: MouseEvent): void;
}>();
const { t } = useI18n();
const letter = computed(() => statusLetter(props.file.status));
</script>

<template>
  <div class="git-row" @dblclick="emit('open-diff')" @contextmenu.prevent="emit('context', $event)">
    <input type="checkbox" :checked="isStaged || included" @change="emit('toggle')" />
    <span class="git-row__letter" :data-s="letter">{{ letter }}</span>
    <span class="git-row__name" dir="auto">{{ file.fileName }}</span>
    <span class="git-row__dir" dir="auto">{{ file.directory }}</span>
    <button class="git-row__open" :title="t('git.openFile')" @click.stop="emit('open-file')">↗</button>
  </div>
</template>
