/**
 * `solomd:wiki-open` → open the linked note (Wave 1b). Registered at setup
 * from `App.vue`; removed in its `onBeforeUnmount`.
 */
import { onBeforeUnmount } from 'vue';
import { useFiles } from './useFiles';
import { useTabsStore } from '../stores/tabs';
import { useWorkspaceStore } from '../stores/workspace';
import { useWorkspaceIndexStore } from '../stores/workspaceIndex';

const WIKI_OPEN_EVENT = 'solomd:wiki-open';
const MD_EXT = /\.md$/i;
const OPEN_OPTIONS = { bypassNewWindow: true } as const;

/** #278 — only `./x` and `../x` are relative; `folder/note` is a vault path. */
function isRelativeTarget(target: string): boolean {
  return /^\.\.?\//.test(target);
}

function dirOf(path: string): string {
  const sep = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return sep >= 0 ? path.slice(0, sep + 1) : '';
}

/** `../x` is kept so the filesystem normalizes `dir + ../…` itself. */
function stripDotSlash(target: string): string {
  return target.startsWith('./') ? target.slice(2) : target;
}

function vaultCandidates(folder: string, target: string): string[] {
  const base = folder.replace(/\/$/, '');
  return MD_EXT.test(target) ? [`${base}/${target}`] : [`${base}/${target}.md`, `${base}/${target}`];
}

export function useWikiOpen(): void {
  const files = useFiles();
  const tabs = useTabsStore();
  const workspace = useWorkspaceStore();
  const workspaceIndex = useWorkspaceIndexStore();

  async function tryOpen(path: string): Promise<boolean> {
    try {
      await files.openPath(path, OPEN_OPTIONS);
      return true;
    } catch {
      return false;
    }
  }

  /** #116 — resolve `./sub/foo.md` against the active file's directory. */
  async function openRelative(target: string): Promise<boolean> {
    const current = tabs.activeTab?.filePath;
    if (!current) return false;
    const path = dirOf(current) + stripDotSlash(target);
    const isOpened = await tryOpen(path);
    if (!isOpened) console.warn('[wiki-open] relative openPath failed:', path);
    return isOpened;
  }

  /** #278 — the index can miss a folder-style target; try it against the vault root. */
  async function openFromVaultRoot(target: string): Promise<boolean> {
    const folder = workspace.currentFolder;
    if (!target.includes('/') || !folder || folder.startsWith('saf:')) return false;
    for (const candidate of vaultCandidates(folder, target)) {
      if (await tryOpen(candidate)) return true;
    }
    return false;
  }

  /** Unresolved: a new draft tab named after the link target. */
  function createDraft(target: string): void {
    const fileName = MD_EXT.test(target) ? target : `${target}.md`;
    const tab = tabs.newTab({ fileName, language: 'markdown' });
    tab.content = `# ${target}\n\n`;
    tabs.activate(tab.id);
  }

  async function onWikiOpen(e: Event): Promise<void> {
    const target: string = (e as CustomEvent).detail?.target || '';
    if (!target) return;
    if (isRelativeTarget(target) && (await openRelative(target))) return;
    const path = await workspaceIndex.resolve(target);
    if (path) {
      await files.openPath(path, OPEN_OPTIONS);
      return;
    }
    if (await openFromVaultRoot(target)) return;
    createDraft(target);
  }

  window.addEventListener(WIKI_OPEN_EVENT, onWikiOpen);
  onBeforeUnmount(() => window.removeEventListener(WIKI_OPEN_EVENT, onWikiOpen));
}
