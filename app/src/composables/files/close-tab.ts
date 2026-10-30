import type { Tab } from '../../types';
import { useThemeStudio } from '../useThemeStudio';
import type { FilesCtx } from './files-ctx.ts';

export type UnsavedDialog = (mode: 'tab' | 'window', fileName: string, count: number) => Promise<'save' | 'discard' | 'cancel'>;

export interface TabCloserDeps {
  getUnsavedDialog: () => UnsavedDialog | undefined;
  saveTab: (tab: Tab) => Promise<boolean>;
  saveThemeStudioDraft: () => Promise<boolean>;
}

export function createTabCloser(ctx: FilesCtx, deps: TabCloserDeps) {
  const { tabs, toasts, t } = ctx;
  const { getUnsavedDialog, saveTab, saveThemeStudioDraft } = deps;

  async function closeThemeStudioTab(id: string): Promise<void> {
    const studio = useThemeStudio();
    const showUnsavedDialog = getUnsavedDialog();
    if (studio.isDirty.value && showUnsavedDialog) {
      tabs.activeId = id;
      const action = await showUnsavedDialog('tab', t('themeStudio.tabTitle'), 1);
      if (action === 'cancel') return;
      if (action === 'save' && !(await saveThemeStudioDraft())) return;
    }
    studio.resetDraft();
    tabs.closeTab(id);
  }

  async function closeTabSafe(id: string) {
    const tab = tabs.tabs.find((t) => t.id === id);
    if (!tab) return;
    if (tab.pinned) {
      toasts.info(t('tabMenu.pinnedNoClose'));
      return;
    }
    if (tab.language === 'theme-studio') return closeThemeStudioTab(id);
    // #222 — same stale-window hazard as saveTab: the dirty check below reads
    // tab.content, which lags the CodeMirror doc by up to 350ms. A close
    // landing inside that window (vim `:q`, fast Ctrl+W) saw a clean tab and
    // discarded the unsynced tail without the unsaved-changes dialog.
    window.dispatchEvent(new Event('solomd:flush-content-sync'));
    const showUnsavedDialog = getUnsavedDialog();
    if (tab.content !== tab.savedContent && showUnsavedDialog) {
      const action = await showUnsavedDialog('tab', tab.fileName, 1);
      if (action === 'save') {
        const ok = await saveTab(tab);
        if (!ok) return;
      } else if (action === 'cancel') {
        return; // go back to editing
      }
      // 'discard' → fall through to close
    }
    tabs.closeTab(id);
  }

  return closeTabSafe;
}
