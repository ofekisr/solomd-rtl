import type { TreeSortMode } from '../../../../lib/tree-sort.ts';
import type { SettingsThis } from './settings-this.ts';

export const explorerActions = {
  toggleFileTree(this: SettingsThis) {
    this.showFileTree = !this.showFileTree;
    this.persist();
  },
  setFileTreeWidth(this: SettingsThis, w: number) {
    // Reasonable bounds — narrower than 180 hides text, wider than 600
    // eats too much editor space.
    const clean = Math.max(180, Math.min(600, Math.round(w) || 240));
    this.fileTreeWidth = clean;
    this.persist();
  },
  toggleExplorerFullNames(this: SettingsThis) {
    this.explorerFullNames = !this.explorerFullNames;
    this.persist();
  },
  toggleExplorerDoubleClickFolders(this: SettingsThis) {
    this.explorerDoubleClickFolders = !this.explorerDoubleClickFolders;
    this.persist();
  },
  toggleExplorerFollowActive(this: SettingsThis) {
    this.explorerFollowActive = !this.explorerFollowActive;
    this.persist();
  },
  toggleExplorerShowHidden(this: SettingsThis) {
    this.explorerShowHidden = !this.explorerShowHidden;
    this.persist();
  },
  toggleExplorerExt(this: SettingsThis, ext: string) {
    const next = new Set(this.explorerExtFilter);
    if (next.has(ext)) next.delete(ext);
    else next.add(ext);
    this.explorerExtFilter = [...next].sort();
    this.persist();
  },
  clearExplorerExtFilter(this: SettingsThis) {
    this.explorerExtFilter = [];
    this.persist();
  },
  setExplorerSort(this: SettingsThis, folder: string, mode: TreeSortMode) {
    const next = { ...this.explorerSortByFolder };
    if (mode === 'name-asc') delete next[folder];
    else next[folder] = mode;
    this.explorerSortByFolder = next;
    this.persist();
  },
};
