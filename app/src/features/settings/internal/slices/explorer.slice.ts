import { z } from 'zod';
import { isMobile } from '../../../../lib/platform.ts';
import type { TreeSortMode } from '../../../../lib/tree-sort.ts';
import { isTreeSortMode } from '../../../../lib/tree-sort.ts';
import type { SettingsSlice } from '../../contracts/index.ts';

export type ExplorerSettings = {
  showFileTree: boolean;
  // Width (in px) of the left file tree sidebar. User-resizable via drag handle.
  fileTreeWidth: number;
  // #182: show full file names in the Explorer tree (wrapped across lines)
  // instead of the default middle-ellipsis truncation.
  explorerFullNames: boolean;
  // #338 — folders in the Explorer open on a double click instead of a single
  // one (a single click then only selects the folder, e.g. as the target of
  // "new file"). Files always open on a single click. Default off.
  explorerDoubleClickFolders: boolean;
  // #333 — the Explorer follows the active document: switching tabs (or
  // opening a file) expands the file's folders and scrolls its row into view,
  // like an IDE's "always select opened file". Default on. It never re-roots
  // the workspace: a file outside it is simply not followed.
  explorerFollowActive: boolean;
  // Show dot-files / dot-folders in the Explorer tree. Off by default: a
  // vault's `.git`, `.obsidian` and friends are noise for most people. On,
  // they're reachable from inside the app instead of only from Finder.
  explorerShowHidden: boolean;
  // #282: show only these file extensions in the Explorer tree (lower-case,
  // no dot; '' is the no-extension bucket). Empty = show everything. It
  // persists, so the tree carries a permanent banner whenever it is set —
  // a filter you can't see is indistinguishable from missing files.
  explorerExtFilter: string[];
  // #342: file-tree order, per workspace folder (key = absolute folder path).
  // A folder without an entry sorts by name, as it always did.
  explorerSortByFolder: Record<string, TreeSortMode>;
};

const schema = z.object({
  showFileTree: z.boolean(),
  fileTreeWidth: z.number(),
  explorerFullNames: z.boolean(),
  explorerDoubleClickFolders: z.boolean(),
  explorerFollowActive: z.boolean(),
  explorerShowHidden: z.boolean(),
  explorerExtFilter: z.array(z.string()),
  explorerSortByFolder: z.record(z.string(), z.custom<TreeSortMode>((value) => isTreeSortMode(value))),
});

function defaults(): ExplorerSettings {
  return {
    showFileTree: !isMobile(),
    fileTreeWidth: 240,
    explorerFullNames: false,
    explorerDoubleClickFolders: false,
    explorerFollowActive: true,
    explorerShowHidden: false,
    explorerExtFilter: [] as string[],
    explorerSortByFolder: {} as Record<string, TreeSortMode>,
  };
}

export const explorerSlice: SettingsSlice<ExplorerSettings> = {
  id: 'explorer',
  schema,
  defaults,
  normalize(parsed, merged) {
    merged.explorerSortByFolder = {};
    if (parsed.explorerSortByFolder && typeof parsed.explorerSortByFolder === 'object') {
      for (const [k, v] of Object.entries(parsed.explorerSortByFolder as Record<string, unknown>)) {
        if (isTreeSortMode(v)) merged.explorerSortByFolder[k] = v;
      }
    }
  },
};
