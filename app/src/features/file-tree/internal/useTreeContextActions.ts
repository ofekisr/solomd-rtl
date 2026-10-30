import { computed } from 'vue';
import { clipboardPort } from '../../../platform/index.ts';
import { revealInFileManager } from '../../../lib/reveal-in-file-manager';
import { useWorkspaceStore } from '../../../stores/workspace';
import { useFiles } from '../../../composables/useFiles';
import { useToastsStore } from '../../../stores/toasts';
import { useGithubSyncStore } from '../../../stores/githubSync';
import { isMindmapPath, isXmindPath } from '../../../lib/mindmap-format';
import { entryKey } from '../../../lib/mindmap-workbench';
import { useMindmapWorkbenchStore } from '../../../stores/mindmapWorkbench';
import { fileDraft, openWorkbench, useMindmapWorkbench } from '../../../composables/useMindmapWorkbench';
import { copyMapText } from '../../../lib/mindmap-payload';
import { useTabsStore } from '../../../stores/tabs';
import { useTilesStore } from '../../../stores/tiles';
import type { PaneSide } from '../../../lib/pane-place';
import { useI18n } from '../../../i18n';
import { NEW_FILE_TYPES } from '../../../lib/new-file-types';
import type { FileTreeState } from './useFileTreeState.ts';
import type { TreeNode } from './tree-types.ts';

const CTX_MENU_WIDTH = 180;
const CTX_SUB_WIDTH = 160;
const CTX_SUB_ITEM_HEIGHT = 30;

export const PANE_SIDES: PaneSide[] = ['left', 'right', 'down', 'up'];

export const isMmap = (path: string): boolean => isMindmapPath(path) && !isXmindPath(path);

export function useTreeContextActions(state: FileTreeState) {
  const { ctx, isNewFileSubOpen, selected } = state;
  const workspace = useWorkspaceStore();
  const files = useFiles();
  const toasts = useToastsStore();
  const ghSync = useGithubSyncStore();
  const tabs = useTabsStore();
  const workbench = useMindmapWorkbenchStore();
  const { readSource } = useMindmapWorkbench();
  const { t } = useI18n();

  const isNewFileSubFlipped = computed(
    () => !!ctx.value && ctx.value.x + CTX_MENU_WIDTH + CTX_SUB_WIDTH > window.innerWidth,
  );
  const isNewFileSubRaised = computed(
    () => !!ctx.value && ctx.value.y + NEW_FILE_TYPES.length * CTX_SUB_ITEM_HEIGHT > window.innerHeight,
  );

  function openCtx(e: MouseEvent, node: TreeNode | null) {
    e.preventDefault();
    e.stopPropagation();
    // Right-clicking a row selects it (the usual desktop convention), so the
    // menu's actions and "new file" agree about what "here" means. Empty-area
    // clicks keep whatever was selected.
    if (node) selected.value = { path: node.path, isDir: !!node.is_dir };
    ctx.value = { x: e.clientX, y: e.clientY, node };
  }
  function closeCtx() {
    ctx.value = null;
    isNewFileSubOpen.value = false;
  }

  /** v4.6.1 — Tolaria-parity "Copy Git URL": repository-backed blob URL for a
   *  file node, built from the linked remote + relative path (branch=main). */
  async function copyGitUrl(node: TreeNode) {
    const folder = workspace.currentFolder;
    const remote = ghSync.status?.remote_url ?? '';
    const m = remote.match(/(?:@|:\/\/)([^/:]+)[:/]([^/]+)\/(.+?)(?:\.git)?$/i);
    if (!folder || !m) {
      toasts.warning(t('explorer.copyGitUrlNoRepo') || 'This workspace has no linked Git remote.');
      return;
    }
    const [, host, owner, repo] = m;
    const sep = node.path.includes('\\') ? '\\' : '/';
    const folderNorm = folder.endsWith(sep) ? folder : folder + sep;
    const rel = node.path.slice(folderNorm.length).split('\\').join('/').split('/').map(encodeURIComponent).join('/');
    const blobSeg = /gitlab/i.test(host) ? '/-/blob/' : '/blob/';
    await clipboardPort.writeText(`https://${host}/${owner}/${repo}${blobSeg}main/${rel}`);
    toasts.success(t('explorer.copyGitUrlDone') || 'Git URL copied to clipboard.');
    closeCtx();
  }

  function toggleWorkbenchFile(path: string): void {
    const key = entryKey(fileDraft(path));
    if (workbench.has(key)) workbench.removeKey(key);
    else workbench.add(fileDraft(path));
    closeCtx();
  }

  function openWorkbenchWith(path: string): void {
    const draft = fileDraft(path);
    openWorkbench(workbench.has(entryKey(draft)) ? undefined : draft);
    closeCtx();
  }

  async function copyMapFile(path: string): Promise<void> {
    closeCtx();
    try {
      const data = await readSource(path);
      if (!data) {
        toasts.error(t('mindmap.workbenchMissing'));
        return;
      }
      await clipboardPort.writeText(copyMapText(data));
      toasts.success(t('mindmap.mapCopied'));
    } catch (e) {
      toasts.error(String(e));
    }
  }

  /** #120 — copy the node's absolute filesystem path (file OR folder). */
  async function copyNodePath(node: TreeNode) {
    await clipboardPort.writeText(node.path);
    toasts.success(t('explorer.copyPathDone') || 'Path copied.');
    closeCtx();
  }

  function openedTabId(path: string, activeBefore: string | null): string | null {
    const byPath = tabs.tabs.find((tab) => tab.filePath === path);
    if (byPath) return byPath.id;
    return tabs.activeId && tabs.activeId !== activeBefore ? tabs.activeId : null;
  }

  async function openNodeOnSide(node: TreeNode, side: PaneSide) {
    closeCtx();
    const tiles = useTilesStore();
    const previous = { paneId: tiles.focusedPaneId, tabId: tiles.focusedLeaf?.activeTabId ?? '' };
    const activeBefore = tabs.activeId;
    selected.value = { path: node.path, isDir: false };
    await files.openPath(node.path, { bypassNewWindow: true });
    const tabId = openedTabId(node.path, activeBefore);
    if (tabId) tiles.openTabOnSide(side, tabId, previous);
  }

  /** #120 — copy the node's path relative to the workspace root, slash-normalised. */
  async function copyNodeRelativePath(node: TreeNode) {
    const folder = workspace.currentFolder;
    const sep = node.path.includes('\\') ? '\\' : '/';
    let rel = node.path;
    if (folder) {
      const folderNorm = folder.endsWith(sep) ? folder : folder + sep;
      if (node.path.startsWith(folderNorm)) rel = node.path.slice(folderNorm.length);
    }
    await clipboardPort.writeText(rel.split('\\').join('/'));
    toasts.success(t('explorer.copyRelPathDone') || 'Relative path copied.');
    closeCtx();
  }

  async function revealNode(node: TreeNode) {
    closeCtx();
    try {
      await revealInFileManager(node.path);
    } catch (e) {
      toasts.error(`${e}`);
    }
  }

  return {
    isNewFileSubFlipped, isNewFileSubRaised, openCtx, closeCtx, copyGitUrl,
    toggleWorkbenchFile, openWorkbenchWith, copyMapFile, copyNodePath,
    openNodeOnSide, copyNodeRelativePath, revealNode,
  };
}
