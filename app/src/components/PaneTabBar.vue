<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { revealInFileManager } from '../lib/reveal-in-file-manager';
import { useTabsStore } from '../stores/tabs';
import { useToastsStore } from '../stores/toasts';
import { useTilesStore } from '../stores/tiles';
import { useSettingsStore } from '../stores/settings';
import { useWorkspaceStore } from '../stores/workspace';
import { useFiles } from '../composables/useFiles';
import { requestRevealInTree } from '../features/file-tree/contracts/index.ts';
import { shortcutLabel } from '../lib/keybindings';
import { isMacOS } from '../lib/platform';
import { useI18n } from '../i18n';
import { resolveTabLens } from '../lib/mindmap-lens';
import { closableIds } from '../lib/tab-pin';
import MindmapIcon from './MindmapIcon.vue';
import { usePaneTabDrag } from './usePaneTabDrag.ts';
import type { SplitDirection } from '../types';

const props = defineProps<{
  paneId: string;
  activeTabId: string;
}>();

const tabs = useTabsStore();
const tiles = useTilesStore();
const settings = useSettingsStore();
const workspace = useWorkspaceStore();
const files = useFiles();
const { t } = useI18n();
const macChord = isMacOS();
/** "New tab (Ctrl+N)" — the chord is read at render time so a rebind in
 *  Settings shows up here (same reason CommandPalette does it). */
const newTabChord = shortcutLabel('file.new', settings.keybindings, macChord);

const tabsEl = ref<HTMLElement | null>(null);

// #263 / #306 — dragging a tab onto the editor splits it, and the new pane
// had no visible way to close: closing its tab just refills the pane with
// another one, and "Close Pane" lived only in the command palette. The layout
// is also restored on the next launch, so people were left with panes they
// could not get rid of even across reinstalls. Every pane gets a close button
// while there is more than one.
const canClosePane = computed(() => tiles.allLeaves.length > 1);

// When the active tab changes (e.g., opening a new file that creates a tab
// off-screen in a crowded tabbar), scroll it into view so the user sees
// the switch.
watch(
  () => props.activeTabId,
  async (id) => {
    if (!id) return;
    await nextTick();
    const el = tabsEl.value?.querySelector<HTMLElement>(`[data-tab-id="${id}"]`);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  },
);

// ---- Context menu ----
const ctxMenu = ref<{ x: number; y: number; tabId: string } | null>(null);

function onContextMenu(e: MouseEvent, tabId: string) {
  e.preventDefault();
  ctxMenu.value = { x: e.clientX, y: e.clientY, tabId };
}

function closeCtxMenu() {
  ctxMenu.value = null;
}

function splitPane(direction: SplitDirection) {
  tiles.splitPane(props.paneId, direction);
  closeCtxMenu();
}

function closePane() {
  tiles.closePane(props.paneId);
  closeCtxMenu();
}

// Tab-level close operations relative to the tab the menu was opened on.
const ctxFlags = computed(() => {
  if (!ctxMenu.value) return null;
  const list = tabs.tabs;
  const idx = list.findIndex((t) => t.id === ctxMenu.value!.tabId);
  if (idx < 0) return null;
  const target = list[idx];
  const closable = (ids: string[]): boolean => closableIds(ids, list).length > 0;
  return {
    isPinned: !!target?.pinned,
    hasLeft: closable(list.slice(0, idx).map((x) => x.id)),
    hasRight: closable(list.slice(idx + 1).map((x) => x.id)),
    hasOthers: closable(list.filter((x) => x.id !== target.id).map((x) => x.id)),
    hasSaved: closable(list.filter((x) => x.id !== target.id && x.content === x.savedContent).map((x) => x.id)),
    hasAny: closable(list.map((x) => x.id)),
    // Issue #64 — "Open Enclosing Folder" only meaningful when the tab
    // is backed by a real on-disk path. Untitled / unsaved buffers have
    // no path, so the menu item is rendered disabled.
    hasFilePath: !!target?.filePath,
  };
});

async function closeMany(ids: string[]) {
  for (const id of closableIds(ids, tabs.tabs)) {
    if (!tabs.tabs.find((t) => t.id === id)) continue;
    await files.closeTabSafe(id);
  }
}

function togglePin() {
  const m = ctxMenu.value;
  closeCtxMenu();
  if (m) tabs.togglePin(m.tabId);
}

async function onTabAction(action: 'close' | 'closeLeft' | 'closeRight' | 'closeOthers' | 'closeSaved' | 'closeAll' | 'revealInFolder' | 'revealInFileTree') {
  const m = ctxMenu.value;
  closeCtxMenu();
  if (!m) return;
  const list = tabs.tabs;
  const idx = list.findIndex((t) => t.id === m.tabId);
  if (idx < 0) return;
  if (action === 'revealInFolder') {
    const path = list[idx]?.filePath;
    if (!path) return;
    try { await revealInFileManager(path); } catch (e) { useToastsStore().error(`${e}`); }
    return;
  }
  if (action === 'revealInFileTree') {
    const path = list[idx]?.filePath;
    if (!path) return;
    if (!settings.showFileTree) settings.toggleFileTree();
    // Revealing is a view action, so the workspace is left alone when the file
    // is already inside it — re-rooting the tree at the file's folder (what
    // this used to do) moved the user's workspace, churned the recent-folder
    // list, and looked like a no-op whenever the file sat directly in the root.
    // Only a file from outside the workspace needs the tree to follow it;
    // otherwise there would be nothing to point at.
    const root = workspace.currentFolder;
    const sep = path.includes('\\') ? '\\' : '/';
    const inside =
      !!root && (path === root || path.startsWith(root.endsWith(sep) ? root : root + sep));
    if (!inside) {
      const parent = path.replace(/[\\/][^\\/]+$/, '');
      if (parent && parent !== path) workspace.setFolder(parent);
    }
    requestRevealInTree(path);
    return;
  }
  const ids = (() => {
    switch (action) {
      case 'close':       return [m.tabId];
      case 'closeLeft':   return list.slice(0, idx).map((x) => x.id);
      case 'closeRight':  return list.slice(idx + 1).map((x) => x.id);
      case 'closeOthers': return list.filter((x) => x.id !== m.tabId).map((x) => x.id);
      case 'closeSaved':  return list.filter((x) => x.content === x.savedContent).map((x) => x.id);
      case 'closeAll':    return list.map((x) => x.id);
    }
    return [];
  })();
  await closeMany(ids);
}

// ---- #218 — every open tab one click away ----
// With many files open the strip overflows. It scrolls (wheel, middle-drag;
// #106), but its scrollbar is hidden, so nothing says so — "there is no way to switch at all,
// not everything is shown". While the strip overflows, a "⌄" button lists every open tab.
const tabsOverflow = ref(false);
function measureTabsOverflow() {
  const el = tabsEl.value;
  tabsOverflow.value = !!el && el.scrollWidth > el.clientWidth + 1;
}
let tabsRO: ResizeObserver | null = null;
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && tabsEl.value) {
    tabsRO = new ResizeObserver(measureTabsOverflow);
    tabsRO.observe(tabsEl.value);
  }
  measureTabsOverflow();
});
onBeforeUnmount(() => tabsRO?.disconnect());
watch(
  () => tabs.tabs.map((x) => x.fileName).join('\u0000'),
  () => nextTick(measureTabsOverflow),
);

const tabListPos = ref<{ top: number; right: number } | null>(null);
function toggleTabList(e: MouseEvent) {
  if (tabListPos.value) {
    tabListPos.value = null;
    return;
  }
  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
  tabListPos.value = { top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) };
}
function pickFromTabList(tabId: string) {
  tabListPos.value = null;
  tiles.setActiveTab(props.paneId, tabId);
}

const { onTabPointerDown, onTabClick, onTabsWheel, onMiddlePointerDown } = usePaneTabDrag({
  paneId: () => props.paneId, tabsEl, tabs, tiles, files,
});

// Close context menu (and the #218 tab list) on click outside
function onDocClick() {
  if (ctxMenu.value) closeCtxMenu();
  if (tabListPos.value) tabListPos.value = null;
}

onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));
</script>

<template>
  <div class="pane-tabbar">
    <div class="tabs" ref="tabsEl" @wheel.prevent="onTabsWheel">
      <!-- The loop variable is `tab`, not `t`: `t` is the i18n function in
           this component, and `v-for="t in …"` silently shadowed it — any
           `t('key')` written inside the row would have called the tab. -->
      <div
        v-for="tab in tabs.tabs"
        :key="tab.id"
        :data-tab-id="tab.id"
        class="tab"
        :class="{ 'tab--active': tab.id === activeTabId, 'tab--dragging': tiles.dragTabId === tab.id, 'tab--pinned': tab.pinned }"
        @click="onTabClick(tab.id)"
        @pointerdown="onTabPointerDown($event, tab.id)"
        @mousedown.middle="onMiddlePointerDown($event, tab.id)"
        @contextmenu="onContextMenu($event, tab.id)"
        :title="tab.filePath || tab.fileName"
      >
        <span class="tab__name">{{ tab.fileName }}</span>
        <button
          v-if="tab.language === 'markdown'"
          class="tab__outline"
          :class="{ 'tab__outline--active': tab.showOutline }"
          :title="tab.showOutline ? t('tabMenu.hideOutline') : t('tabMenu.showOutline')"
          @click.stop="tabs.toggleOutline(tab.id)"
        >≡</button>
        <button
          v-else-if="tab.language === 'mindmap'"
          class="tab__outline tab__data"
          :class="{ 'tab__outline--active': resolveTabLens(tab) === 'data' }"
          :title="resolveTabLens(tab) === 'data' ? t('tabMenu.hideData') : t('tabMenu.showData')"
          @click.stop="tabs.toggleMindmapData(tab.id)"
        ><MindmapIcon name="lens-data" /></button>
        <span class="tab__dot" v-if="tabs.isDirty(tab.id)">●</span>
        <button
          v-if="tab.pinned"
          class="tab__pin"
          :title="t('tabMenu.unpin')"
          :aria-label="t('tabMenu.unpin')"
          @click.stop="tabs.togglePin(tab.id)"
        ><MindmapIcon name="pin" /></button>
        <button
          v-else
          class="tab__close"
          @click.stop="files.closeTabSafe(tab.id)"
          :aria-label="t('tabMenu.close')"
        >×</button>
      </div>
    </div>
    <button
      v-if="tabsOverflow"
      class="tabbar__list"
      :class="{ 'tabbar__list--open': tabListPos }"
      :title="t('tabMenu.allTabs')"
      :aria-label="t('tabMenu.allTabs')"
      :aria-expanded="!!tabListPos"
      @click.stop="toggleTabList"
    >⌄</button>
    <button class="tabbar__new" @click="files.newFile" :title="newTabChord ? `${t('tabMenu.newTab')} (${newTabChord})` : t('tabMenu.newTab')">+</button>
    <button
      v-if="canClosePane"
      class="tabbar__close-pane"
      :title="t('cmd.tile.closePane')"
      :aria-label="t('cmd.tile.closePane')"
      @click.stop="tiles.closePane(paneId)"
    >
      <!-- A pane with an × through it — a tab's own × is right next to it
           and closes the document, which is not what this does. `.stop`:
           the pane's own click handler would otherwise re-focus the pane that
           was just closed. -->
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
        <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.2" />
        <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
      </svg>
    </button>

    <!-- #218 — all open tabs -->
    <Teleport to="body">
      <div
        v-if="tabListPos"
        class="ctx-menu tablist"
        role="menu"
        :style="{ top: tabListPos.top + 'px', right: tabListPos.right + 'px' }"
        @click.stop
      >
        <button
          v-for="tl in tabs.tabs"
          :key="tl.id"
          class="ctx-item tablist__item"
          :class="{ 'tablist__item--active': tl.id === activeTabId }"
          role="menuitem"
          :title="tl.filePath || tl.fileName"
          @click="pickFromTabList(tl.id)"
        >
          <span class="tablist__name">{{ tl.fileName }}</span>
          <span v-if="tabs.isDirty(tl.id)" class="tablist__dot">●</span>
        </button>
      </div>
    </Teleport>

    <!-- Context menu -->
    <Teleport to="body">
      <div
        v-if="ctxMenu"
        class="ctx-menu"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
        @click.stop
      >
        <button class="ctx-item" @click="togglePin">{{ ctxFlags?.isPinned ? t('tabMenu.unpin') : t('tabMenu.pin') }}</button>
        <button class="ctx-item" :disabled="ctxFlags?.isPinned" @click="onTabAction('close')">{{ t('tabMenu.close') }}</button>
        <div class="ctx-sep" />
        <button class="ctx-item" :disabled="!ctxFlags?.hasLeft"   @click="onTabAction('closeLeft')">{{ t('tabMenu.closeLeft') }}</button>
        <button class="ctx-item" :disabled="!ctxFlags?.hasRight"  @click="onTabAction('closeRight')">{{ t('tabMenu.closeRight') }}</button>
        <button class="ctx-item" :disabled="!ctxFlags?.hasOthers" @click="onTabAction('closeOthers')">{{ t('tabMenu.closeOthers') }}</button>
        <div class="ctx-sep" />
        <button class="ctx-item" :disabled="!ctxFlags?.hasSaved" @click="onTabAction('closeSaved')">{{ t('tabMenu.closeSaved') }}</button>
        <button class="ctx-item" :disabled="!ctxFlags?.hasAny"   @click="onTabAction('closeAll')">{{ t('tabMenu.closeAll') }}</button>
        <div class="ctx-sep" />
        <button class="ctx-item" :disabled="!ctxFlags?.hasFilePath" @click="onTabAction('revealInFolder')">{{ t('tabMenu.revealInFolder') }}</button>
        <button class="ctx-item" :disabled="!ctxFlags?.hasFilePath" @click="onTabAction('revealInFileTree')">{{ t('tabMenu.revealInFileTree') }}</button>
        <div class="ctx-sep" />
        <button class="ctx-item" @click="splitPane('horizontal')">{{ t('cmd.tile.splitRight') }}</button>
        <button class="ctx-item" @click="splitPane('vertical')">{{ t('cmd.tile.splitDown') }}</button>
        <div class="ctx-sep" v-if="tiles.allLeaves.length > 1" />
        <button class="ctx-item" v-if="tiles.allLeaves.length > 1" @click="closePane">{{ t('cmd.tile.closePane') }}</button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped src="./PaneTabBar.css"></style>
