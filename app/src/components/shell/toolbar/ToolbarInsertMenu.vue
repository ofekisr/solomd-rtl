<script setup lang="ts">
import Icon from '../../Icons.vue';
import { useI18n } from '../../../i18n';
import { useTilesStore } from '../../../stores/tiles';
import { useFiles } from '../../../composables/useFiles';
import { dialogPort } from '../../../platform/index.ts';
import {
  dispatchFormat as sendFormat,
  dispatchInsert as sendInsert,
  openImageUrlDialog as sendOpenImageUrlDialog,
  pickAndInsertImage as sendPickAndInsertImage,
} from './toolbar-actions.ts';
import { useInjectedDropdowns } from './useToolbarDropdowns.ts';
import { useMeasureOnUpdate } from './useToolbarOverflow.ts';
import { useToolbarTips } from './useToolbarTips.ts';

const { t } = useI18n();
const { chord } = useToolbarTips();
const tiles = useTilesStore();
const files = useFiles();
const { insertOpen, insertBtnRef, floatStyle, toggleDropdown } = useInjectedDropdowns();
useMeasureOnUpdate();

function dispatchFormat(kind: string): void {
  sendFormat(kind);
  insertOpen.value = false;
}
function dispatchInsert(snippet: string): void {
  sendInsert(snippet, tiles.focusedPaneId);
  insertOpen.value = false;
}
async function pickAndInsertImage(): Promise<void> {
  insertOpen.value = false;
  await sendPickAndInsertImage({
    dialog: dialogPort,
    startDir: () => files.filePickerStartDir(),
    paneId: tiles.focusedPaneId,
  });
}
function openImageUrlDialog(): void {
  insertOpen.value = false;
  sendOpenImageUrlDialog();
}
</script>

<template>
  <div class="toolbar__group">
    <div class="dropdown">
      <button
        ref="insertBtnRef"
        class="icon-btn"
        @click="toggleDropdown('insert')"
        :title="t('toolbar.insertTooltip')"
      >
        <Icon name="insert" />
        <Icon name="chevron-down" :size="10" />
      </button>
      <Teleport to="body">
        <div v-if="insertOpen" class="dropdown__menu" :style="floatStyle">
          <!-- #296 — the formatting commands, with the chord beside each: the
               menu is where a mouse user learns the key. These wrap the
               selection; the snippet items below only insert. -->
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('bold')">
            <span class="dropdown__name">{{ t('cmd.fmt.bold') }}</span>
            <kbd v-if="chord('fmt.bold')" class="dropdown__kbd">{{ chord('fmt.bold') }}</kbd>
          </button>
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('italic')">
            <span class="dropdown__name">{{ t('cmd.fmt.italic') }}</span>
            <kbd v-if="chord('fmt.italic')" class="dropdown__kbd">{{ chord('fmt.italic') }}</kbd>
          </button>
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('strike')">
            <span class="dropdown__name">{{ t('cmd.fmt.strike') }}</span>
            <kbd v-if="chord('fmt.strike')" class="dropdown__kbd">{{ chord('fmt.strike') }}</kbd>
          </button>
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('h1')">
            <span class="dropdown__name">{{ t('cmd.fmt.h1') }}</span>
            <kbd v-if="chord('fmt.h1')" class="dropdown__kbd">{{ chord('fmt.h1') }}</kbd>
          </button>
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('h2')">
            <span class="dropdown__name">{{ t('cmd.fmt.h2') }}</span>
            <kbd v-if="chord('fmt.h2')" class="dropdown__kbd">{{ chord('fmt.h2') }}</kbd>
          </button>
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('h3')">
            <span class="dropdown__name">{{ t('cmd.fmt.h3') }}</span>
            <kbd v-if="chord('fmt.h3')" class="dropdown__kbd">{{ chord('fmt.h3') }}</kbd>
          </button>
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('ul')">
            <span class="dropdown__name">{{ t('cmd.fmt.ul') }}</span>
            <kbd v-if="chord('fmt.ul')" class="dropdown__kbd">{{ chord('fmt.ul') }}</kbd>
          </button>
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('ol')">
            <span class="dropdown__name">{{ t('cmd.fmt.ol') }}</span>
            <kbd v-if="chord('fmt.ol')" class="dropdown__kbd">{{ chord('fmt.ol') }}</kbd>
          </button>
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('task')">
            <span class="dropdown__name">{{ t('cmd.fmt.task') }}</span>
            <kbd v-if="chord('fmt.task')" class="dropdown__kbd">{{ chord('fmt.task') }}</kbd>
          </button>
          <div class="dropdown__sep"></div>
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('codeblock')">
            <span class="dropdown__name">{{ t('toolbar.insertCodeBlock') }}</span>
            <kbd v-if="chord('fmt.codeblock')" class="dropdown__kbd">{{ chord('fmt.codeblock') }}</kbd>
          </button>
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('code')">
            <span class="dropdown__name">{{ t('toolbar.insertInlineCode') }}</span>
            <kbd v-if="chord('fmt.code')" class="dropdown__kbd">{{ chord('fmt.code') }}</kbd>
          </button>
          <div class="dropdown__sep"></div>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="dispatchInsert('\n$$\n$|$\n$$\n')">
            <span class="dropdown__name">{{ t('toolbar.insertMathBlock') }}</span>
          </button>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="dispatchInsert('$$|$$')">
            <span class="dropdown__name">{{ t('toolbar.insertMathInline') }}</span>
          </button>
          <div class="dropdown__sep"></div>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="dispatchInsert('\n| $|$ | Header |\n| --- | --- |\n| cell | cell |\n')">
            <span class="dropdown__name">{{ t('toolbar.insertTable') }}</span>
          </button>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="dispatchInsert('\n```mermaid\ngraph TD\n  A[$|$] --> B[End]\n```\n')">
            <span class="dropdown__name">{{ t('toolbar.insertMermaid') }}</span>
          </button>
          <div class="dropdown__sep"></div>
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('link')">
            <span class="dropdown__name">{{ t('toolbar.insertLink') }}</span>
            <kbd v-if="chord('fmt.link')" class="dropdown__kbd">{{ chord('fmt.link') }}</kbd>
          </button>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="pickAndInsertImage()">
            <span class="dropdown__name">{{ t('toolbar.insertImage') }}</span>
          </button>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="openImageUrlDialog()">
            <span class="dropdown__name">{{ t('toolbar.insertNetworkImage') }}</span>
          </button>
          <button class="dropdown__item dropdown__item--single dropdown__item--kbd" @mousedown.prevent="dispatchFormat('quote')">
            <span class="dropdown__name">{{ t('toolbar.insertQuote') }}</span>
            <kbd v-if="chord('fmt.quote')" class="dropdown__kbd">{{ chord('fmt.quote') }}</kbd>
          </button>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="dispatchInsert('\n---\n')">
            <span class="dropdown__name">{{ t('toolbar.insertDivider') }}</span>
          </button>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style scoped src="./toolbar-controls.css"></style>
<style scoped src="./toolbar-dropdown.css"></style>
