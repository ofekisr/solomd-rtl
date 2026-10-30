/**
 * Keep folder-scoped back ends in step with the open workspace (Wave 1b):
 * workspace index, properties, capture/REST servers, RAG, spellcheck and the
 * git pane. Called once from `App.vue` setup.
 */
import { watch, watchEffect } from 'vue';
import { capturePort, settingsPort } from '../platform/index.ts';
import { useSettingsStore } from '../stores/settings';
import { useWorkspaceStore } from '../stores/workspace';
import { useWorkspaceIndexStore } from '../stores/workspaceIndex';
import { usePropertiesStore } from '../stores/properties';
import { useRagStore } from '../stores/rag';
import { useGitPaneStore } from '../stores/gitPane';
import { isGitMockActive } from '../lib/git-pane/serviceFactory';
import { useGitPaneAvailable } from './useGitPaneAvailable';

const MOCK_REPO_FOLDER = '/repo';
const DEFAULT_SPELLCHECK_LANG = 'en_US';

function syncGitPane(): void {
  const settings = useSettingsStore();
  const workspace = useWorkspaceStore();
  const gitPane = useGitPaneStore();
  const isAvailable = useGitPaneAvailable();
  let isServiceBound = false;
  watch(
    [isAvailable, () => workspace.currentFolder],
    ([available, folder]) => {
      if (!available) {
        if (isServiceBound) void gitPane.open(null);
        return;
      }
      if (!isServiceBound) {
        gitPane.bindService();
        isServiceBound = true;
      }
      void gitPane.open(folder ?? (isGitMockActive() ? MOCK_REPO_FOLDER : null));
    },
    { immediate: true },
  );
  watch(() => settings.gitTrustedRepos, (roots) => gitPane.setTrustedRoots(roots), { immediate: true });
}

/** v2.3 — scan when RAG turns on; refresh the status line when the folder changes. */
function syncRag(): void {
  const settings = useSettingsStore();
  const workspace = useWorkspaceStore();
  const rag = useRagStore();
  let lastFolder: string | null = null;
  let wasEnabled = false;
  watchEffect(() => {
    const folder = workspace.currentFolder;
    const isEnabled = settings.ragEnabled;
    if (folder === lastFolder && isEnabled === wasEnabled) return;
    lastFolder = folder;
    wasEnabled = isEnabled;
    if (!folder) {
      rag.refreshStatus(null);
      return;
    }
    if (isEnabled) rag.setEnabled(folder, true).catch(() => {});
    else rag.refreshStatus(folder).catch(() => {});
  });
  // Mirror index updates into single-file rescans so embeddings stay fresh.
  window.addEventListener('solomd:rag-bus', (e) => {
    if (!settings.ragEnabled) return;
    const path = (e as CustomEvent).detail?.path;
    if (typeof path === 'string') rag.reindexFile(workspace.currentFolder, path).catch(() => {});
  });
}

/** v2.0 F2 / #246 — load the Hunspell dictionary for `spellcheckLang`, reloading on change. */
function syncSpellcheck(): void {
  const settings = useSettingsStore();
  let loadedFor: string | null = null;
  watchEffect(async () => {
    const lang = settings.spellcheckLang || DEFAULT_SPELLCHECK_LANG;
    if (!settings.spellcheckEnabled || loadedFor === lang) return;
    try {
      await settingsPort.spellcheckInit({ lang });
      loadedFor = lang;
    } catch (e) {
      console.warn('spellcheck_init failed', e);
    }
  });
}

export function useWorkspaceSync(): void {
  const workspace = useWorkspaceStore();
  const workspaceIndex = useWorkspaceIndexStore();
  const properties = usePropertiesStore();

  syncGitPane();
  watchEffect(() => {
    workspaceIndex.setFolder(workspace.currentFolder).catch(() => {});
  });
  // v4.6.1 F1 — display-mode overrides + pinned list live in .solomd/properties.json.
  watchEffect(() => {
    properties.setFolder(workspace.currentFolder).catch(() => {});
  });
  // v2.4 / v4.0 — the capture and REST servers write into the open folder (503 without one).
  watchEffect(() => {
    const folder = workspace.currentFolder ?? null;
    capturePort.captureSetWorkspace({ folder }).catch(() => {});
    capturePort.restSetWorkspace({ folder }).catch(() => {});
  });
  syncRag();
  // v2.6 — a GitHub pull changed files on disk; rescan so tree + backlinks catch up.
  window.addEventListener('solomd:remote-pulled', () => {
    void workspaceIndex.rescan();
  });
  syncSpellcheck();
}
