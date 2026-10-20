import { invoke } from '@tauri-apps/api/core';
import type { ScannedFolder } from '../lib/mindmap-folder-tree';

interface DirEntry { name: string; path: string; is_dir: boolean }
export interface TreeScanResult { root: ScannedFolder; truncated: boolean }

export const MAX_TREE_ENTRIES = 20000;
const HIDDEN_PREFIX = '.';
const SKIPPED_DIRS = new Set(['node_modules', '.git']);
const PATH_SEPARATOR = '/';
const NAME_SEPARATOR = /[\\/]/;
const FALLBACK_ROOT_NAME = 'folder';

function folderOf(name: string, relPath: string): ScannedFolder {
  return { name, relPath, isHidden: name.startsWith(HIDDEN_PREFIX), files: [], folders: [] };
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name);
}

async function scanFolderTree(path: string): Promise<TreeScanResult> {
  const rootName = path.split(NAME_SEPARATOR).filter(Boolean).pop() ?? FALLBACK_ROOT_NAME;
  const root = folderOf(rootName, '');
  let seen = 0;
  let truncated = false;
  const walk = async (dir: string, folder: ScannedFolder): Promise<void> => {
    const entries = await invoke<DirEntry[]>('list_dir', { path: dir, showHidden: true });
    for (const entry of [...entries].sort(byName)) {
      if (seen >= MAX_TREE_ENTRIES) { truncated = true; return; }
      seen += 1;
      if (!entry.is_dir) {
        folder.files.push({ name: entry.name, isHidden: entry.name.startsWith(HIDDEN_PREFIX) });
        continue;
      }
      if (SKIPPED_DIRS.has(entry.name)) continue;
      const relPath = folder.relPath ? `${folder.relPath}${PATH_SEPARATOR}${entry.name}` : entry.name;
      const sub = folderOf(entry.name, relPath);
      folder.folders.push(sub);
      await walk(entry.path, sub);
    }
  };
  await walk(path, root);
  return { root, truncated };
}

export function useFolderTreeScan(): { scanFolderTree(path: string): Promise<TreeScanResult> } {
  return { scanFolderTree };
}
