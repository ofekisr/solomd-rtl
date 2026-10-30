import { fsPort } from '../platform/index.ts';
import type { ScannedFolder, TreeEntry } from '../lib/mindmap-folder-tree';
import { folderState, joinPath, type ScopeRules } from '../lib/mindmap-folder-scope';

interface DirEntry { name: string; path: string; is_dir: boolean }
export interface TreeScanResult { root: ScannedFolder; truncated: boolean }

export const MAX_TREE_ENTRIES = 20000;
const TRUNCATED_SENTINEL = '__solomd_truncated__';
const PATH_SEPARATOR = '/';
const NAME_SEPARATOR = /[\\/]/;
const FALLBACK_ROOT_NAME = 'folder';

export function folderNameOf(absPath: string): string {
  return absPath.split(NAME_SEPARATOR).filter(Boolean).pop() ?? FALLBACK_ROOT_NAME;
}

function absPathOf(rootAbs: string, relPath: string): string {
  return relPath ? `${rootAbs}${PATH_SEPARATOR}${relPath}` : rootAbs;
}

async function readDir(absPath: string): Promise<DirEntry[]> {
  const entries = await fsPort.listDir({ path: absPath, showHidden: true });
  return entries.filter((entry) => entry.name !== TRUNCATED_SENTINEL);
}

async function listEntries(rootAbs: string, relPath: string): Promise<TreeEntry[]> {
  const entries = await readDir(absPathOf(rootAbs, relPath));
  return entries.map((entry) => ({ name: entry.name, relPath: joinPath(relPath, entry.name), isDir: entry.is_dir }));
}

async function scanForMap(rootAbs: string, scope: ScopeRules): Promise<TreeScanResult> {
  const root: ScannedFolder = { name: folderNameOf(rootAbs), relPath: '', files: [], folders: [] };
  let seen = 0;
  let truncated = false;
  const walk = async (folder: ScannedFolder): Promise<void> => {
    for (const entry of await listEntries(rootAbs, folder.relPath)) {
      if (seen >= MAX_TREE_ENTRIES) { truncated = true; return; }
      seen += 1;
      if (!entry.isDir) { folder.files.push(entry.name); continue; }
      if (folderState(entry.relPath, scope) === 'excluded') continue;
      const sub: ScannedFolder = { name: entry.name, relPath: entry.relPath, files: [], folders: [] };
      folder.folders.push(sub);
      await walk(sub);
    }
  };
  await walk(root);
  return { root, truncated };
}

export function useFolderTreeScan(): {
  listEntries(rootAbs: string, relPath: string): Promise<TreeEntry[]>;
  scanForMap(rootAbs: string, scope: ScopeRules): Promise<TreeScanResult>;
} {
  return { listEntries, scanForMap };
}
