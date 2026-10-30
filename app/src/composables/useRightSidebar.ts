/**
 * Right-sidebar host state (Wave 1b). `App.vue` calls `createRightSidebar()`
 * once; `RightSidebar.vue`, `SidebarContextMenu.vue` and `AppLayout.vue` read
 * the same instance through `useRightSidebar()`.
 */
import { computed, inject, nextTick, provide, ref, watch, type InjectionKey } from 'vue';
import { useSettingsStore, setRightSidebarShell } from '../stores/settings';
import { useTabsStore } from '../stores/tabs';
import { useWorkspaceStore } from '../stores/workspace';
import { useViewport } from './useViewport';
import { IS_APP_STORE_BUILD } from '../lib/app-build';
import { orderVisiblePanes, paneFlexStyle, type RsPaneId, type RsPaneStyle } from '../lib/right-sidebar';
import type { FolderSearchPreset, FolderSearchRequest } from '../lib/folder-search';

const AGENT_MIN_WIDTH = 440;
const DEFAULT_SIDEBAR_WIDTH = 260;

export type RightSidebar = ReturnType<typeof buildRightSidebar>;

const RIGHT_SIDEBAR_KEY: InjectionKey<RightSidebar> = Symbol('rightSidebar');

function buildPaneVisibility() {
  const settings = useSettingsStore();
  const tabs = useTabsStore();
  const workspace = useWorkspaceStore();
  const isMarkdown = () => tabs.activeTab?.language === 'markdown';
  const hasFolder = () => !!workspace.currentFolder;
  const searchOpen = ref(false);
  return {
    searchOpen,
    search: computed(() => searchOpen.value),
    outline: computed(() => !!tabs.activeTab?.showOutline && isMarkdown()),
    backlinks: computed(() => settings.showBacklinks && isMarkdown() && hasFolder()),
    relationships: computed(() => settings.showRelationships && isMarkdown() && hasFolder()),
    tags: computed(() => settings.showTagsPanel && hasFolder()),
    // Workspace-scoped like Tags: the task list is the vault's, not the note's.
    tasks: computed(() => settings.showTasksPanel && hasFolder()),
    neighborhood: computed(() => settings.showNeighborhood && isMarkdown() && hasFolder()),
    types: computed(() => settings.showTypesPanel && hasFolder()),
    // v4.0.2 — decoupled from the pane's × button (#55): hiding it keeps sync on.
    history: computed(
      () => settings.autoGitEnabled && settings.showHistoryPanel && isMarkdown() && hasFolder(),
    ),
    inspector: computed(() => settings.showInspector && isMarkdown() && hasFolder()),
    // App Store builds strip the AI/Agent surface entirely (Apple 3.1.1).
    agent: computed(() => !IS_APP_STORE_BUILD && settings.showAgentPanel),
  };
}

function buildRightSidebar() {
  const settings = useSettingsStore();
  const tabs = useTabsStore();
  const { isNarrow } = useViewport();
  const panes = buildPaneVisibility();
  const { searchOpen } = panes;
  const searchPrefill = ref<string | undefined>(undefined);
  const searchPreset = ref<FolderSearchPreset | undefined>(undefined);
  const sidebarCtx = ref<{ x: number; y: number } | null>(null);

  const visibility = computed(() => ({
    search: panes.search.value,
    outline: panes.outline.value,
    backlinks: panes.backlinks.value,
    relationships: panes.relationships.value,
    tags: panes.tags.value,
    tasks: panes.tasks.value,
    neighborhood: panes.neighborhood.value,
    types: panes.types.value,
    history: panes.history.value,
    inspector: panes.inspector.value,
    agent: panes.agent.value,
  }));

  /**
   * Whether any pane could draw right now, ignoring the master hide flag.
   * The settings store reads this through `setRightSidebarShell` so toggling
   * the strip on always has a visible result — one source of truth.
   */
  const hasRenderablePane = computed(() => Object.values(visibility.value).some(Boolean));

  // Master "hide" toggle wins over individual panes.
  const isVisible = computed(() => !settings.rightSidebarHidden && hasRenderablePane.value);

  // Outline is the fallback because it is the only pane that needs no folder.
  setRightSidebarShell({
    visible: () => isVisible.value,
    ensureRenderable: () => {
      if (hasRenderablePane.value) return true;
      const tab = tabs.activeTab;
      if (!tab || tab.language !== 'markdown') return false;
      tab.showOutline = true;
      settings.showOutline = true;
      return true;
    },
  });

  /** #168 — one drawer at a time on a phone; the file tree wins. */
  const narrowDrawer = computed<'left' | 'right' | null>(() => {
    if (!isNarrow.value) return null;
    if (settings.showFileTree || settings.showViewsPanel) return 'left';
    if (isVisible.value) return 'right';
    return null;
  });

  function closeNarrowDrawer(): void {
    if (settings.showFileTree) settings.toggleFileTree();
    if (settings.showViewsPanel) settings.toggleViewsPanel();
    if (isVisible.value) settings.toggleRightSidebar();
  }

  const visiblePanes = computed<RsPaneId[]>(() => orderVisiblePanes(settings.rsPaneOrder, visibility.value));

  // Pane changes resize the editor; CodeMirror's ResizeObserver may lag a frame.
  watch(visiblePanes, () => {
    nextTick(() => {
      requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('solomd:relayout')));
    });
  });

  function paneStyle(id: string): RsPaneStyle {
    return paneFlexStyle(visiblePanes.value, settings.rightSidebarPaneHeights, id);
  }

  function openCtx(e: MouseEvent): void {
    e.preventDefault();
    sidebarCtx.value = { x: e.clientX, y: e.clientY };
  }

  function closeCtx(): void {
    sidebarCtx.value = null;
  }

  function snapshotPanes() {
    return {
      showBacklinks: settings.showBacklinks,
      showRelationships: settings.showRelationships,
      showTagsPanel: settings.showTagsPanel,
      showTasksPanel: settings.showTasksPanel,
      showNeighborhood: settings.showNeighborhood,
      showTypesPanel: settings.showTypesPanel,
      showHistoryPanel: settings.showHistoryPanel,
      showAgentPanel: settings.showAgentPanel,
    };
  }

  function hasNoPaneOn(): boolean {
    return (
      !searchOpen.value &&
      !panes.outline.value &&
      !settings.showBacklinks &&
      !settings.showRelationships &&
      !settings.showTagsPanel &&
      !settings.showTasksPanel &&
      !panes.neighborhood.value &&
      !settings.showTypesPanel &&
      !settings.showHistoryPanel &&
      (IS_APP_STORE_BUILD || !settings.showAgentPanel)
    );
  }

  /** Run a pane toggle, then hide the strip if it is empty or un-hide it if it gained a pane. */
  function ctxToggle(toggleFn: () => void): void {
    const before = snapshotPanes();
    toggleFn();
    if (hasNoPaneOn()) {
      settings.hideRightSidebarFromPane(before);
    } else if (settings.rightSidebarHidden) {
      settings.ensureRightSidebarVisible();
    }
    closeCtx();
  }

  /** #209 — every way of opening search goes through `ctxToggle` so a hidden strip un-hides. */
  function toggleGlobalSearch(): void {
    ctxToggle(() => {
      searchOpen.value = !searchOpen.value;
    });
  }

  function openGlobalSearchPane(): void {
    ctxToggle(() => {
      searchOpen.value = true;
    });
  }

  function onFolderSearch(e: Event): void {
    const detail = (e as CustomEvent<FolderSearchRequest>).detail;
    searchPreset.value = { ...detail, nonce: Date.now() };
    openGlobalSearchPane();
  }

  /** Re-clicking the same tag resets the prefill so GlobalSearch refocuses. */
  function onFilterTag(tag: string): void {
    const prefill = `#${tag}`;
    if (searchOpen.value && searchPrefill.value === prefill) {
      searchPrefill.value = undefined;
      nextTick(() => {
        searchPrefill.value = prefill;
      });
    } else {
      searchPrefill.value = prefill;
    }
    openGlobalSearchPane();
  }

  // Agent chat needs room: auto-bump to 440 unless the user resized wider.
  const widthStyle = computed(() => {
    const isAgentCramped = panes.agent.value && settings.sideSidebarWidth <= DEFAULT_SIDEBAR_WIDTH;
    const width = isAgentCramped ? AGENT_MIN_WIDTH : settings.sideSidebarWidth;
    return { width: `${width}px`, flexBasis: `${width}px` };
  });

  function startResize(side: 'left' | 'right', ev: MouseEvent): void {
    ev.preventDefault();
    const startX = ev.clientX;
    const startWidth = parseInt(widthStyle.value.width.replace('px', ''), 10);
    const onMove = (m: MouseEvent) => {
      const dx = m.clientX - startX;
      settings.setSideSidebarWidth(startWidth + (side === 'right' ? -dx : dx));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return {
    panes,
    searchOpen,
    searchPrefill,
    searchPreset,
    sidebarCtx,
    isVisible,
    narrowDrawer,
    closeNarrowDrawer,
    visiblePanes,
    paneStyle,
    openCtx,
    closeCtx,
    ctxToggle,
    toggleGlobalSearch,
    onFolderSearch,
    onFilterTag,
    widthStyle,
    startResize,
  };
}

export function createRightSidebar(): RightSidebar {
  const sidebar = buildRightSidebar();
  provide(RIGHT_SIDEBAR_KEY, sidebar);
  return sidebar;
}

export function useRightSidebar(): RightSidebar {
  const sidebar = inject(RIGHT_SIDEBAR_KEY);
  if (!sidebar) throw new Error('useRightSidebar() called outside createRightSidebar()');
  return sidebar;
}
