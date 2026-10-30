<script setup lang="ts">
import { onMounted, onBeforeUnmount, watch, watchEffect, provide, type Ref } from 'vue';
import {
  androidPort,
  capturePort,
  clipboardPort,
  eventsPort,
  openerPort,
  settingsPort,
  windowCommandsPort,
  windowPort,
} from './platform/index.ts';
import { createWindowService } from './shell/window.service.ts';
import { createFileOpenService } from './shell/file-open.service.ts';
import { createShortcutsService, type OpenableOverlayHandle } from './shell/shortcuts.service.ts';
import { createSessionService } from './shell/session.service.ts';
import { createUpdatesService } from './shell/updates.service.ts';
import { createEditorRegistry } from './shell/editor-registry.service.ts';
import { SETTINGS_PAGES } from './shell/settings-pages.ts';
import { EDITOR_REGISTRY_FACTORY } from './features/editor/contracts/editor-registry.port.ts';
import { SETTINGS_PAGES_KEY } from './features/settings/contracts/settings-pages.key.ts';
import type { ToastKind } from './stores/toasts';
import { openNewWindow } from './lib/new-window';
import ReadingView from './components/ReadingView.vue';
import UiPreview from './components/UiPreview.vue';
import AppLayout from './components/shell/AppLayout.vue';
import AppDialogs from './components/shell/AppDialogs.vue';
import { useAutoCommit } from './composables/useAutoCommit';
import { useGithubSync } from './composables/useGithubSync';
import { useSessionRestore } from './composables/useSessionRestore';
import { createRightSidebar } from './composables/useRightSidebar';
import { createAppDialogs } from './composables/useAppDialogs';
import { createCenterView } from './composables/useCenterView';
import { createEditorCursor } from './composables/useEditorCursor';
import { useAppTypography } from './composables/useAppTypography';
import { useWorkspaceSync } from './composables/useWorkspaceSync';
import { useWikiOpen } from './composables/useWikiOpen';
import { useThemeStore } from './stores/theme';
import { useThemePaint } from './composables/useThemePaint';
import { installStudioPreview } from './composables/useThemeStudio';
import { useTabsStore } from './stores/tabs';
import { useSettingsStore } from './stores/settings';
import { useWindowsStore, isAuxLabel } from './stores/windows';
import { useTilesStore } from './stores/tiles';
import { usePomodoroStore } from './stores/pomodoro';
import { useFiles } from './composables/useFiles';
import { useExport } from './composables/useExport';
import { useShortcuts } from './composables/useShortcuts';
import { useFileWatcher } from './composables/useFileWatcher';
import { useAutoSave } from './composables/useAutoSave';
import { isIOS, isMobile } from './lib/platform';
import { useGitErrorToasts } from './composables/useGitErrorToasts';
import { useViewport } from './composables/useViewport';
import { useI18n } from './i18n';
import { quickCaptureError } from './composables/useQuickCaptureStatus.ts';
import { track } from './lib/telemetry';
import { openWelcomeTour } from './lib/welcome-tour';
import { useWorkspaceStore } from './stores/workspace';
import { IS_APP_STORE_BUILD } from './lib/app-build';
import { FOLDER_SEARCH_EVENT } from './lib/folder-search';

/* v4.6 dev-only UI gallery: `?uikit` renders only the design-system preview. */
const showUiKit = new URLSearchParams(location.search).has('uikit');

const tabs = useTabsStore();
const settings = useSettingsStore();
const themeStore = useThemeStore();
const windowsStore = useWindowsStore();
const tiles = useTilesStore();
const files = useFiles();
const exporter = useExport();
const workspace = useWorkspaceStore();
const { t } = useI18n();
const { isNarrow } = useViewport();

// Host state (Wave 1b): created once here, read by shell components via `use*()`.
provide(EDITOR_REGISTRY_FACTORY, createEditorRegistry);
provide(SETTINGS_PAGES_KEY, SETTINGS_PAGES);
const sidebar = createRightSidebar();
const dialogs = createAppDialogs();
createCenterView();
createEditorCursor();
const {
  paletteOpen,
  quickSwitcherOpen,
  settingsOpen,
  helpOpen,
  ragSearchOpen,
  cjkProofreadOpen,
  aboutOpen,
  wizardOpen,
  androidPickerOpen,
  androidRestartNeeded,
} = dialogs;
const fileChangedOpen = dialogs.fileChanged.isOpen;

useGitErrorToasts();
useWorkspaceSync();
useAppTypography();
useWikiOpen();
useAutoCommit().start();
// v2.6: GitHub sync pushes AutoGit commits and pulls on a timer; dormant without `.solomd/sync.json`.
useGithubSync().start();
// v2.6.1: offer tabs from a sibling device when its cloud-folder session is fresher.
useSessionRestore().start();
// v2.5 F4: pick up an in-progress focus session from before the reload.
usePomodoroStore().rehydrate();
// Dev-bridge hook so the self-test harness can drive the store directly.
(window as any).usePomodoroStore = usePomodoroStore;

// Child composables (useFiles) ask for the unsaved-changes dialog via provide/inject.
provide('showUnsavedDialog', dialogs.unsaved.show);
(window as any).__solomd_showUnsavedDialog = dialogs.unsaved.show;

useShortcuts({
  openPalette: () => (paletteOpen.value = true),
  openSettings: () => (settingsOpen.value = true),
  openHelp: () => (helpOpen.value = true),
  openGlobalSearch: () => sidebar.toggleGlobalSearch(),
  openRagSearch: () => (ragSearchOpen.value = true),
  openQuickSwitcher: () => (quickSwitcherOpen.value = true),
  openCjkProofread: () => (cjkProofreadOpen.value = true),
});

useFileWatcher(dialogs.fileChanged.show);
useAutoSave(files.saveTab);

// Shell services (Wave 1 PR-9): the logic lives in `shell/`; App.vue binds
// Vue state into it and keeps every watcher / listener registration here.
async function showToast(kind: ToastKind, message: string): Promise<void> {
  (await import('./stores/toasts')).useToastsStore()[kind](message);
}

function overlay(flag: Ref<boolean>): OpenableOverlayHandle {
  return {
    isOpen: () => flag.value,
    close: () => {
      flag.value = false;
    },
    open: () => {
      flag.value = true;
    },
  };
}

const windowService = createWindowService({
  windowPort,
  eventsPort,
  windowCommandsPort,
  document,
  isDev: import.meta.env.DEV,
  getGlobalZoom: () => settings.globalZoom,
  setGlobalZoom: (zoom) => settings.setGlobalZoom(zoom),
  isWheelZoomEnabled: () => settings.wheelZoomEnabled,
  autoSaveDirtyTabs: () => files.autoSaveDirtyTabs(),
  persistSession: () => {
    tabs.persist?.();
    tiles.persist();
  },
  reloadWindows: () => windowsStore.reload(),
  getAuxLabels: () => windowsStore.auxLabels,
  unregisterWindow: (label) => windowsStore.unregister(label),
  isAuxLabel,
});

const session = createSessionService({
  persistTabs: () => tabs.persist(),
  persistTiles: () => tiles.persist(),
  syncTilesFromTabs: (activeTabId) => tiles.syncFromTabs(activeTabId),
  validateTiles: () => tiles.validate(tabs.tabs),
  getFirstTabId: () => tabs.tabs[0]?.id,
  hasFocusedActiveTab: () => !!tiles.focusedLeaf?.activeTabId,
  initDefaultTiles: (firstTabId) => tiles.initDefault(firstTabId),
  syncActiveTab: () => tiles.syncActiveTab(),
});

const fileOpen = createFileOpenService({
  eventsPort,
  windowPort,
  androidPort,
  windowCommandsPort,
  openerPort,
  openPath: (path, options) => files.openPath(path, options),
  getActiveFilePath: () => tabs.activeTab?.filePath,
  getSafTreeUri: () => workspace.safTreeUri,
  setFolder: (folder) => workspace.setFolder(folder),
  setSafVault: (treeUri, rootId, name) => workspace.setSafVault(treeUri, rootId, name),
  isFileTreeShown: () => settings.showFileTree,
  toggleFileTree: () => settings.toggleFileTree(),
  showToast,
  loadSafFs: () => import('./lib/saf-fs'),
  setAndroidPickerOpen: (isOpen) => {
    androidPickerOpen.value = isOpen;
  },
  setAndroidRestartNeeded: (isNeeded) => {
    androidRestartNeeded.value = isNeeded;
  },
  getFocusedPaneId: () => tiles.focusedPaneId,
});

const shortcuts = createShortcutsService({
  windowCommandsPort,
  settingsPort,
  capturePort,
  eventsPort,
  clipboardPort,
  windowPort,
  actions: {
    files,
    exportPdfPrint: () => exporter.exportPdfPrint(),
    activeTabId: () => tabs.activeId,
    toggleOutline: (id) => tabs.toggleOutline(id),
    zoom: settings,
    toggleTheme: () => settings.toggleTheme(themeStore.mode),
    toggleFileTree: () => settings.toggleFileTree(),
    cycleViewMode: () => settings.cycleViewMode(),
    isReadingMode: () => settings.viewMode === 'reading',
    exitReadingMode: () => settings.exitReadingMode(),
    overlays: {
      sidebarCtx: { isOpen: () => !!sidebar.sidebarCtx.value, close: sidebar.closeCtx },
      about: overlay(aboutOpen),
      cjkProofread: overlay(cjkProofreadOpen),
      ragSearch: overlay(ragSearchOpen),
      fileChanged: overlay(fileChangedOpen),
      search: overlay(sidebar.searchOpen),
      help: overlay(helpOpen),
      quickSwitcher: overlay(quickSwitcherOpen),
      palette: overlay(paletteOpen),
      settings: overlay(settingsOpen),
    },
    openNewWindow,
    openExternalFile: () => fileOpen.openExternalFile(),
    toggleGlobalSearch: sidebar.toggleGlobalSearch,
    showToast,
    t: (key) => t(key),
  },
});

const updates = createUpdatesService({
  isAutoCheckEnabled: () => settings.autoCheckUpdate,
  checkForUpdateOnStartup: async () => (await import('./lib/check-update')).checkForUpdateOnStartup(),
  openReleaseUrl: async (url) => (await import('./lib/check-update')).openReleaseUrl(url),
  // #171 — no auto-opening the browser; the toast lingers and opens the page on click.
  showToast: async (message, timeoutMs, onClick) => {
    (await import('./stores/toasts')).useToastsStore().success(message, timeoutMs, onClick);
  },
  t: (key, params) => t(key, params),
});
// Auto-persist tabs and tiles on every change.
watch(
  () => [tabs.tabs.map((t) => [t.id, t.fileName, t.filePath, t.content, t.savedContent, t.language].join('|')).join(';'), tabs.activeId],
  () => session.persist(),
  { deep: false },
);
watch(
  () => JSON.stringify(tiles.root),
  () => session.persistTiles(),
);
// Propagate tabs.activeId (newTab / openFromDisk) to the focused tile leaf.
watch(
  () => tabs.activeId,
  (newActiveId) => session.syncTilesFromTabs(newActiveId),
);

// Window title — "<filename> — SoloMD" so the OS can tell windows apart (#53).
watch(
  () => tabs.activeTab?.fileName,
  (name) => {
    void windowService.applyWindowTitle(name);
  },
  { immediate: true },
);

// v2.4: on iOS / iPad, a markdown tab opens in reading mode unless the user opted out.
watch(
  () => tabs.activeId,
  (newActiveId) => {
    if (!newActiveId) return;
    if (!isIOS()) return;
    if (!settings.readingByDefaultOnMobile) return;
    const t = tabs.activeTab;
    if (!t || t.language !== 'markdown') return;
    if (settings.viewMode === 'reading') return;
    settings.lastNonReadingViewMode = settings.viewMode;
    settings.viewMode = 'reading';
    settings.persist();
  },
  { immediate: true },
);

// v4.3.0 (#72): global zoom. #192 — native webview zoom; CSS zoom is the browser fallback.
watchEffect(() => windowService.applyZoom(settings.globalZoom || 1));

// Sync native menu bar language and accelerators (#180). Spread the
// keybindings here so the effect tracks keys that do not exist yet.
watchEffect(() => shortcuts.syncNativeMenu({ ...settings.keybindings }, settings.language));

useThemePaint();
installStudioPreview();

// Quick capture's OS hotkey: push on start and on every change; off
// unregisters. Read settings before the await so the effect tracks them.
watchEffect(async () => {
  const isEnabled = settings.quickCaptureEnabled;
  const shortcut = isEnabled ? settings.quickCaptureShortcut : '';
  quickCaptureError.value = await shortcuts.syncQuickCaptureShortcut(isEnabled, shortcut);
});

// The editor find bar (scope Folder / All) streams its query to the search pane.
window.addEventListener(FOLDER_SEARCH_EVENT, sidebar.onFolderSearch);
onBeforeUnmount(() => window.removeEventListener(FOLDER_SEARCH_EVENT, sidebar.onFolderSearch));

// Window size + position are persisted by tauri-plugin-window-state on the
// Rust side. Remove the stale localStorage entry from earlier versions.
windowService.removeStaleWindowState();

onMounted(async () => {
  // #153 / #148 — Android insets, SAF vault restore and SAF pick resolution.
  await fileOpen.initAndroid();

  // #87(3) — if a startup view mode is pinned, force it now (overrides the
  // persisted last-used `viewMode`). Empty/null = resume whatever the user
  // left in, as before.
  // #128 — a pinned "reading" mode with nothing to show (restore-tabs off, or
  // no tabs persisted → just a blank Untitled) lands on a blank reading window,
  // so reading is deferred until there's a real document to read.
  // #144(B) — but the #128 gate must not silently DROP the pin (that made the
  // setting look dead whenever restore-tabs was off: last-used mode always
  // won). Defer instead: apply reading the moment the first readable tab
  // appears (file opened / first text typed), then stop watching.
  if (settings.startupViewMode && settings.startupViewMode !== settings.viewMode) {
    const hasReadable = () =>
      tabs.tabs.some((t) => t.filePath || (t.content && t.content.trim().length > 0));
    if (settings.startupViewMode !== 'reading' || hasReadable()) {
      settings.setViewMode(settings.startupViewMode);
    } else {
      const stop = watch(hasReadable, (ok) => {
        if (!ok) return;
        settings.setViewMode('reading');
        stop();
      });
    }
  }

  window.addEventListener('keydown', shortcuts.onEsc);
  window.addEventListener('wheel', windowService.onWheelZoom, { passive: false, capture: true });
  window.addEventListener('blur', windowService.onWindowBlur);
  window.addEventListener('solomd:open-help', shortcuts.onOpenHelpEvent);
  window.addEventListener('solomd:open-global-search', shortcuts.onOpenSearchEvent);
  window.addEventListener('solomd:open-cjk-proofread', shortcuts.onOpenCjkProofreadEvent);

  track('app_launched', {
    locale: settings.language,
    theme: themeStore.mode,
    live_preview: settings.livePreview ? 1 : 0,
  });

  await fileOpen.listenOpenedFile();
  fileOpen.listenAndroidEvents();
  await fileOpen.handleDeepLinks();
  await fileOpen.drainPendingOpens();
  await fileOpen.openPathFromQuery();
  // #103 — aux windows are never resurrected; the main window clears stale entries.
  windowService.cleanAuxRegistry();

  // First-launch welcome tour: only when there are no tabs at all (fresh
  // install or user has cleared session) and we haven't shown it before.
  const isFreshLaunch = tabs.tabs.length === 0 && !settings.welcomeShown;
  if (isFreshLaunch) {
    openWelcomeTour();
    settings.markWelcomeShown();
  } else if (tabs.tabs.length === 0) {
    tabs.newTab();
  }

  // v4.0 first-run agent setup wizard. Fires after the welcome tour on a
  // fresh install — once. Re-openable from Settings → AI ("Run setup
  // wizard again") for users who skipped it. We wait one tick so the
  // welcome tour overlay (if any) shows first. App Store builds skip
  // entirely (Apple 3.1.1 — no AI surface).
  if (!IS_APP_STORE_BUILD && !settings.agentWizardSeen) {
    setTimeout(() => {
      wizardOpen.value = true;
    }, isFreshLaunch ? 800 : 0);
  }
  // Settings → AI's "Run setup wizard again" button asks here. Registered
  // as a named handler (see `onOpenAgentWizard` below) so onBeforeUnmount
  // can detach it — otherwise every HMR remount stacks another listener.
  window.addEventListener('solomd:open-agent-wizard', onOpenAgentWizard);
  window.addEventListener('solomd:open-image-url-dialog', dialogs.onOpenImageUrlDialog);

  session.initTiles();
  await windowService.listenCloseRequested();
  await windowService.listenWindowDestroyed();
  await shortcuts.start();
  await fileOpen.listenDragDrop();
  await updates.start();
});

/** Routes an accepted rewrite through the insert-markdown channel (Editor exposes no EditorView). */
function onAIRewriteAccept(e: Event) {
  const { from, to, replacement } = (e as CustomEvent).detail || {};
  if (typeof from !== 'number' || typeof to !== 'number' || typeof replacement !== 'string') return;
  window.dispatchEvent(
    new CustomEvent('solomd:insert-markdown', {
      detail: { snippet: replacement, paneId: tiles.focusedPaneId, replaceFrom: from, replaceTo: to },
    }),
  );
}
// AIRewriteOverlay self-closes; cancel needs no work here.
function onAIRewriteCancel() {}
function onOpenAgentWizard() {
  wizardOpen.value = true;
}

window.addEventListener('solomd:ai-rewrite-accept', onAIRewriteAccept as EventListener);
window.addEventListener('solomd:ai-rewrite-cancel', onAIRewriteCancel as EventListener);
window.addEventListener('solomd:open-settings', dialogs.onOpenSettingsEvent as EventListener);

onBeforeUnmount(() => {
  window.removeEventListener('keydown', shortcuts.onEsc);
  window.removeEventListener('wheel', windowService.onWheelZoom, { capture: true } as EventListenerOptions);
  window.removeEventListener('blur', windowService.onWindowBlur);
  window.removeEventListener('solomd:open-help', shortcuts.onOpenHelpEvent);
  window.removeEventListener('solomd:open-global-search', shortcuts.onOpenSearchEvent);
  window.removeEventListener('solomd:open-cjk-proofread', shortcuts.onOpenCjkProofreadEvent);
  window.removeEventListener('solomd:ai-rewrite-accept', onAIRewriteAccept as EventListener);
  window.removeEventListener('solomd:ai-rewrite-cancel', onAIRewriteCancel as EventListener);
  window.removeEventListener('solomd:open-settings', dialogs.onOpenSettingsEvent as EventListener);
  window.removeEventListener('solomd:open-agent-wizard', onOpenAgentWizard);
  window.removeEventListener('solomd:open-image-url-dialog', dialogs.onOpenImageUrlDialog);
  fileOpen.stop();
  shortcuts.stop();
  windowService.stop();
});
</script>

<template>
  <UiPreview v-if="showUiKit" />
  <div
    v-else
    class="app"
    :class="{
      'app--reading': settings.viewMode === 'reading',
      'app--mobile': isMobile(),
      'app--narrow': isNarrow,
      'app--drawer-left': sidebar.narrowDrawer.value === 'left',
      'app--drawer-right': sidebar.narrowDrawer.value === 'right',
    }"
  >
    <!-- v2.4 reading mode swaps the whole editing chrome for ReadingView; dialogs stay mounted. -->
    <ReadingView v-if="settings.viewMode === 'reading'" />
    <AppLayout v-else />
    <AppDialogs
      :pick-android-folder="fileOpen.onAndroidFolderPick"
      :request-android-storage="fileOpen.requestAndroidStorage"
      :restart-android="fileOpen.doAndroidRestart"
    />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  /* #125 — 100% (not 100vw/100vh) so the app-wide CSS `zoom` doesn't render
     the root wider/taller than the window (vw/vh ignore zoom). */
  height: 100%;
  width: 100%;
  background: var(--bg);
  color: var(--text);
  /* #73 / #153 — mobile system-bar insets. Android's WebView reports
     env(safe-area-inset-top) as 0 under forced edge-to-edge, so the native
     `--android-safe-*` vars are injected; max() covers iOS, Android and desktop (0). */
  padding-top: max(env(safe-area-inset-top, 0px), var(--android-safe-top, 0px));
  padding-bottom: max(env(safe-area-inset-bottom, 0px), var(--android-safe-bottom, 0px));
  padding-left: env(safe-area-inset-left, 0);
  padding-right: env(safe-area-inset-right, 0);
  box-sizing: border-box;
}
</style>
