import { useRagStore } from '../../../stores/rag';
import { useSettingsStore } from '../../../stores/settings';
import { useTabsStore } from '../../../stores/tabs';
import { useToastsStore } from '../../../stores/toasts';
import { useWorkspaceStore } from '../../../stores/workspace';

export interface RagToggles {
  onToggleRagEnabled: () => Promise<void>;
  onReindexNow: () => Promise<void>;
  onToggleOutlineGlobal: () => void;
}

export function useRagToggles(): RagToggles {
  const settings = useSettingsStore();
  const workspace = useWorkspaceStore();
  const toasts = useToastsStore();
  const tabs = useTabsStore();
  const rag = useRagStore();

  async function onToggleRagEnabled(): Promise<void> {
    settings.toggleRagEnabled();
    const shouldIndex = settings.ragEnabled && !!workspace.currentFolder;
    await rag.setEnabled(workspace.currentFolder, shouldIndex);
    if (rag.lastError) toasts.error(`RAG: ${rag.lastError}`);
  }

  async function onReindexNow(): Promise<void> {
    if (!workspace.currentFolder) return;
    await rag.reindex(workspace.currentFolder);
    if (rag.lastError) {
      toasts.error(`RAG reindex failed: ${rag.lastError}`);
      return;
    }
    toasts.success(`Reindexed ${rag.status?.indexed_files ?? 0} files`);
  }

  /** Apply the new default to every open markdown tab so the toggle feels immediate, not only prospective. */
  function onToggleOutlineGlobal(): void {
    settings.toggleOutline();
    tabs.setShowOutlineAll(settings.showOutline);
  }
  return { onToggleRagEnabled, onReindexNow, onToggleOutlineGlobal };
}
