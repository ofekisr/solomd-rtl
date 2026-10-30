import { computed, ref, watch } from 'vue';
import { fsPort } from '../../../platform/index.ts';
import { useWorkspaceStore } from '../../../stores/workspace';
import { useSettingsStore } from '../../../stores/settings';
import { useToastsStore } from '../../../stores/toasts';
import { useI18n } from '../../../i18n';
import { isSafPath } from '../../../lib/saf-fs';
import type { FileTreeState } from './useFileTreeState.ts';
import { joinPath } from './tree-paths.ts';

interface FilterDeps {
  refreshPreservingExpansion: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// #282 — "can the file tree get a file-format filter, e.g. I only want to show txt or
// md documents under this folder". The checkbox list offers what the vault actually contains, not a
// canned list of twenty formats.
//
// The filter persists, which makes a hidden filter the obvious failure mode:
// "my files are gone". So whenever it's set the tree shows a banner naming
// the active types with a one-click clear, and the header button changes
// state — see [blank-pane traps]: a persisted flag that hides content must
// never be invisible.
// ---------------------------------------------------------------------------
export function useTreeFilter(state: FileTreeState, deps: FilterDeps) {
  const { filterOpen, sortOpen } = state;
  const workspace = useWorkspaceStore();
  const settings = useSettingsStore();
  const toasts = useToastsStore();
  const { t } = useI18n();

  const extList = ref<{ ext: string; count: number }[]>([]);
  const extFilter = computed<string[]>(() => settings.explorerExtFilter ?? []);

  /** Absolute paths of folders whose subtree holds a match, or null when no
   *  filter is active. The tree is lazy, so this can't be derived from the
   *  loaded nodes — it comes from one backend walk per filter change. */
  const filterDirs = ref<Set<string> | null>(null);

  const filterLabel = computed(() =>
    extFilter.value
      .map((e) => (e === '' ? t('explorer.filterNoExt') || 'no extension' : '.' + e))
      .join('、'),
  );

  async function refreshFilterDirs() {
    const rootPath = workspace.currentFolder;
    if (!rootPath || extFilter.value.length === 0 || isSafPath(rootPath)) {
      filterDirs.value = null;
      return;
    }
    try {
      const rels = await fsPort.fsDirsWithExtensions({
        root: rootPath,
        exts: extFilter.value,
        showHidden: settings.explorerShowHidden,
      });
      filterDirs.value = new Set(
        rels.map((rel) => rel.split('/').reduce((acc, seg) => joinPath(acc, seg), rootPath)),
      );
    } catch (err) {
      console.warn('[FileTree] dirs-with-extensions failed', err);
      // Failing open beats hiding folders we could not verify.
      filterDirs.value = null;
    }
  }

  async function openFilter() {
    sortOpen.value = false;
    filterOpen.value = !filterOpen.value;
    if (!filterOpen.value) return;
    const rootPath = workspace.currentFolder;
    if (!rootPath || isSafPath(rootPath)) {
      extList.value = [];
      return;
    }
    try {
      extList.value = await fsPort.fsListExtensions({
        root: rootPath,
        showHidden: settings.explorerShowHidden,
      });
    } catch (err) {
      toasts.error(String(err));
      extList.value = [];
    }
  }

  function extLabel(ext: string): string {
    return ext === '' ? t('explorer.filterNoExt') || 'no extension' : '.' + ext;
  }

  // `immediate` matters: on startup the workspace folder is restored before
  // this watcher exists, so without it a filter that survived the last session
  // would sit there with its banner showing while the tree stayed unfiltered
  // until the next manual refresh.
  watch(
    [extFilter, () => settings.explorerShowHidden, () => workspace.currentFolder],
    () => {
      void refreshFilterDirs();
    },
    { immediate: true },
  );
  // Flipping "show hidden files" changes what every already-loaded directory
  // should contain, so the whole tree is re-listed — expanded folders included.
  watch(
    () => settings.explorerShowHidden,
    () => {
      void deps.refreshPreservingExpansion();
    },
  );

  return { extList, extFilter, filterDirs, filterLabel, refreshFilterDirs, openFilter, extLabel };
}

export type TreeFilter = ReturnType<typeof useTreeFilter>;
