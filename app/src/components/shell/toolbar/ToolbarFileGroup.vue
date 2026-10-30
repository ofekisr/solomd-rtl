<script setup lang="ts">
import Icon from '../../Icons.vue';
import { useI18n } from '../../../i18n';
import { useWorkspaceStore } from '../../../stores/workspace';
import { useTabsStore } from '../../../stores/tabs';
import { useToastsStore } from '../../../stores/toasts';
import { useFiles } from '../../../composables/useFiles';
import { useExport } from '../../../composables/useExport';
import { openerPort } from '../../../platform/index.ts';
import { openExternal, shortPath } from './toolbar-actions.ts';
import { useInjectedDropdowns } from './useToolbarDropdowns.ts';
import { useMeasureOnUpdate } from './useToolbarOverflow.ts';
import { useToolbarTips } from './useToolbarTips.ts';

const { t } = useI18n();
const { tip } = useToolbarTips();
const workspace = useWorkspaceStore();
const tabs = useTabsStore();
const toasts = useToastsStore();
const files = useFiles();
const exporter = useExport();
const { newOpen, recentOpen, exportOpen, newBtnRef, recentBtnRef, exportBtnRef, floatStyle, toggleDropdown } =
  useInjectedDropdowns();
useMeasureOnUpdate();

function onOpenExternal(): Promise<void> {
  return openExternal({ tabs, toasts, opener: openerPort, noFileMessage: t('toast.openExternalNoFile') });
}
</script>

<template>
  <div class="toolbar__group">
    <div class="dropdown">
      <button
        ref="newBtnRef"
        class="icon-btn"
        @click="toggleDropdown('new')"
        :title="tip('toolbar.newFile', 'file.new')"
      >
        <Icon name="new" />
        <Icon name="chevron-down" :size="10" />
      </button>
      <Teleport to="body">
        <div v-if="newOpen" class="dropdown__menu dropdown__menu--narrow" :style="floatStyle">
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="files.newFile(); newOpen = false">
            <Icon name="new" />
            <span class="dropdown__name">{{ t('toolbar.newMarkdown') }}</span>
            <span class="dropdown__shortcut">Ctrl+N</span>
          </button>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="files.newTextFile(); newOpen = false">
            <Icon name="new-text" />
            <span class="dropdown__name">{{ t('toolbar.newPlainText') }}</span>
            <span class="dropdown__shortcut">Ctrl+Alt+N</span>
          </button>
        </div>
      </Teleport>
    </div>
    <button class="icon-btn" @click="files.openFile" :title="tip('toolbar.openFileTooltip', 'file.open')">
      <Icon name="open" />
    </button>
    <div class="dropdown">
      <button
        ref="recentBtnRef"
        class="icon-btn"
        @click="toggleDropdown('recent')"
        :title="t('toolbar.recent')"
      >
        <Icon name="recent" />
        <Icon name="chevron-down" :size="10" />
      </button>
      <Teleport to="body">
        <div v-if="recentOpen" class="dropdown__menu" :style="floatStyle">
          <div v-if="!workspace.recentFiles.length" class="dropdown__empty">{{ t('toolbar.noRecent') }}</div>
          <button
            v-for="p in workspace.recentFiles"
            :key="p"
            class="dropdown__item dropdown__item--recent"
            @mousedown.prevent="files.openPath(p); recentOpen = false"
            :title="p"
          >
            <span class="dropdown__name">{{ shortPath(p) }}</span>
            <span class="dropdown__path">{{ p }}</span>
            <!-- #112 — remove ONE stale entry without touching the file
                 (the only management before this was nuke-the-whole-list). -->
            <span
              class="dropdown__remove"
              role="button"
              :title="t('toolbar.removeRecent')"
              @mousedown.stop.prevent="workspace.removeRecent(p)"
            >✕</span>
          </button>
          <div v-if="workspace.recentFiles.length" class="dropdown__sep"></div>
          <button
            v-if="workspace.recentFiles.length"
            class="dropdown__item dropdown__item--muted"
            @mousedown.prevent="workspace.clearRecent(); recentOpen = false"
          >{{ t('toolbar.clearRecent') }}</button>
        </div>
      </Teleport>
    </div>
    <button class="icon-btn" @click="files.openFolder" v-bind:title="t('toolbar.openFolder')">
      <Icon name="folder" />
    </button>
    <button class="icon-btn" data-phone-primary @click="files.saveActive" v-bind:title="tip('toolbar.save', 'file.save')">
      <Icon name="save" />
    </button>
    <button class="icon-btn" @click="files.saveActiveAs" :title="tip('toolbar.saveAsTooltip', 'file.saveAs')">
      <Icon name="save-as" />
    </button>
    <button class="icon-btn" @click="onOpenExternal" :title="tip('toolbar.openExternalTooltip', 'file.openExternal')">
      <Icon name="external" />
    </button>
    <div class="dropdown">
      <button
        ref="exportBtnRef"
        class="icon-btn"
        @click="toggleDropdown('export')"
        :title="tip('toolbar.exportTooltip', 'export.pdfPrint')"
      >
        <Icon name="export" />
        <Icon name="chevron-down" :size="10" />
      </button>
      <Teleport to="body">
        <div v-if="exportOpen" class="dropdown__menu" :style="floatStyle">
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="exporter.exportHtml(); exportOpen = false">
            <span class="dropdown__name">{{ t('toolbar.exportHtml') }}</span>
          </button>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="exporter.exportDocx(); exportOpen = false">
            <span class="dropdown__name">{{ t('toolbar.exportDocx') }}</span>
          </button>
          <!-- Gitee IK8QJQ — these two produce very different PDFs and the
               names alone did not say so. `exportPdf` goes through
               html2pdf.js (html2canvas), which rasterises the page, so the
               text is not selectable and files run several times larger;
               `exportPdfPrint` hands off to the OS print engine and yields
               real vector text. Both are worth keeping — the raster path
               saves straight to a file with no dialog — so label the
               tradeoff rather than hide it, and lead with the text one. -->
          <button class="dropdown__item" @mousedown.prevent="exporter.exportPdfPrint(); exportOpen = false">
            <span class="dropdown__name">{{ t('toolbar.exportPdfPrint') }}</span>
            <span class="dropdown__path">{{ t('toolbar.exportPdfPrintHint') }}</span>
          </button>
          <button class="dropdown__item" @mousedown.prevent="exporter.exportPdf(); exportOpen = false">
            <span class="dropdown__name">{{ t('toolbar.exportPdf') }}</span>
            <span class="dropdown__path">{{ t('toolbar.exportPdfHint') }}</span>
          </button>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="exporter.exportImage(); exportOpen = false">
            <span class="dropdown__name">{{ t('toolbar.exportImage') }}</span>
          </button>
          <div class="dropdown__sep"></div>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="exporter.copyAsHtml(); exportOpen = false">
            <span class="dropdown__name">{{ t('toolbar.copyHtml') }}</span>
          </button>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="exporter.copyAsPlainText(); exportOpen = false">
            <span class="dropdown__name">{{ t('toolbar.copyPlain') }}</span>
          </button>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="exporter.copyAsMarkdown(); exportOpen = false">
            <span class="dropdown__name">{{ t('toolbar.copyMarkdown') }}</span>
          </button>
          <button class="dropdown__item dropdown__item--single" @mousedown.prevent="exporter.copyAsImage(); exportOpen = false">
            <span class="dropdown__name">{{ t('toolbar.copyImage') }}</span>
          </button>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<style scoped src="./toolbar-controls.css"></style>
<style scoped src="./toolbar-dropdown.css"></style>
