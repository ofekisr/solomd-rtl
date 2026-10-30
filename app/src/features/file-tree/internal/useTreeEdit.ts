import { computed, h, nextTick, provide, type ComputedRef, type Ref } from 'vue';
import { fsPort } from '../../../platform/index.ts';
import { useWorkspaceStore } from '../../../stores/workspace';
import { useFiles } from '../../../composables/useFiles';
import { useToastsStore } from '../../../stores/toasts';
import { useTabsStore } from '../../../stores/tabs';
import { usePendingDeletes } from '../../../composables/usePendingDeletes';
import { fromSafPath, isSafPath, safCreate, toSafPath } from '../../../lib/saf-fs';
import { DEFAULT_NEW_FILE_EXT, newFilePlaceholder } from '../../../lib/new-file-types';
import { renameInOrder } from '../../../lib/tree-sort';
import { baseName } from './useTreeDrag.ts';
import type { FileTreeState } from './useFileTreeState.ts';
import type { TreeSort } from './useTreeSort.ts';
import type { TreeLoad } from './useTreeLoad.ts';
import type { TreeRefresh } from './useTreeRefresh.ts';
import { joinPath, orderKey } from './tree-paths.ts';
import { repointTab } from './tree-repoint.ts';
import { FTREE_EDIT, INDENT_BASE, INDENT_STEP, indentGuides } from './useTreeRender.ts';
import type { TreeNode } from './tree-types.ts';

const NEW_FOLDER_NAME = 'New Folder';

interface EditDeps {
  closeCtx: () => void;
  showInboxOnly: Ref<boolean> | ComputedRef<boolean>;
  extFilter: Ref<string[]> | ComputedRef<string[]>;
}

export function useTreeEdit(
  state: FileTreeState,
  load: TreeLoad,
  sort: TreeSort,
  refresh: TreeRefresh,
  deps: EditDeps,
) {
  const { root, editing, editInput, manualOrder, findNode } = state;
  const workspace = useWorkspaceStore();
  const files = useFiles();
  const toasts = useToastsStore();
  const tabs = useTabsStore();
  const pendingDeletes = usePendingDeletes();

  // #321 — the inline input shows up where the entry will actually be: at the
  // end of the folder it is created in, or in place of the row being renamed.
  // It used to sit at the very top of the tree whatever the target, so a file
  // created inside a folder three levels down appeared to be going to the
  // root. Nodes are rendered by FileTreeNode (a render function), which draws
  // the row through this. The tree filters (inbox, extension) can hide the
  // target, and then the row falls back to the top, where it always was.
  const editInTree = computed(() => {
    const e = editing.value;
    if (!e || deps.showInboxOnly.value || deps.extFilter.value.length) return false;
    if (e.kind === 'rename') return !!e.original && !!findNode(e.original);
    return e.parent === root.value?.path || !!findNode(e.parent)?.expanded;
  });

  function renderEditRow(depth: number) {
    const e = editing.value;
    if (!e) return null;
    return h('li', { class: 'ftree__edit', style: { paddingLeft: `${INDENT_BASE + depth * INDENT_STEP}px` } }, [
      ...indentGuides(depth),
      h('span', { class: 'ftree__caret' }, e.kind === 'new-dir' ? '›' : ''),
      h('span', { class: 'ftree__icon' }, e.kind === 'new-dir' ? '📁' : e.kind === 'new-file' ? '📝' : '•'),
      h('input', {
        ref: (el: unknown) => {
          if (el) editInput.value = el as HTMLInputElement;
        },
        value: e.name,
        class: 'ftree__edit-input',
        spellcheck: 'false',
        onInput: (ev: Event) => {
          if (editing.value) editing.value.name = (ev.target as HTMLInputElement).value;
        },
        onKeydown: (ev: KeyboardEvent) => {
          if (ev.key === 'Escape') {
            ev.preventDefault();
            cancelEdit();
            return;
          }
          onRenameKey(ev);
        },
        onBlur: commitEdit,
        // A click in the box must not reach the row underneath and open or
        // toggle it.
        onClick: (ev: MouseEvent) => ev.stopPropagation(),
        onPointerdown: (ev: PointerEvent) => ev.stopPropagation(),
      }),
    ]);
  }
  provide(FTREE_EDIT, { editing, editInTree, renderEditRow });
  // One stable component for the root level: an inline `() => …` in the
  // template would be a new component type on every render, and the input
  // would be torn down — and lose focus — on every keystroke.
  const EditRowAtRoot = () => renderEditRow(0);

  /** Open a collapsed folder before creating in it, so the new row has
   *  somewhere to appear. */
  async function expandForCreate(parent: string) {
    const node = findNode(parent);
    if (node && node.is_dir && !node.expanded) await load.expandDir(node);
  }

  async function focusEditInput(selectBaseNameOnly: boolean) {
    await nextTick();
    const el = editInput.value;
    if (!el) return;
    el.focus();
    if (!selectBaseNameOnly) {
      el.select();
      return;
    }
    // Select just the basename (not the .md) so a single keystroke replaces
    // the placeholder, Finder-style.
    const dot = el.value.lastIndexOf('.');
    el.setSelectionRange(0, dot > 0 ? dot : el.value.length);
  }

  async function startNewFile(parent: string, ext: string = DEFAULT_NEW_FILE_EXT) {
    deps.closeCtx();
    await expandForCreate(parent);
    editing.value = { kind: 'new-file', parent, name: newFilePlaceholder(ext) };
    await focusEditInput(true);
  }

  async function startNewFolder(parent: string) {
    deps.closeCtx();
    await expandForCreate(parent);
    editing.value = { kind: 'new-dir', parent, name: NEW_FOLDER_NAME };
    await focusEditInput(false);
  }

  async function startRename(node: TreeNode) {
    deps.closeCtx();
    const parent = node.path.replace(/[\\/][^\\/]+$/, '');
    editing.value = {
      kind: 'rename',
      parent,
      original: node.path,
      name: node.name,
    };
    await focusEditInput(true);
  }

  async function commitNewFile(parent: string, name: string) {
    // Default to .md when the user didn't type an extension — we only
    // edit md/txt anyway, so this is the right bias.
    const finalName = /\.[a-z0-9]+$/i.test(name) ? name : `${name}.md`;
    // #148 — SAF vault: create the file via ContentResolver and open its
    // content-URI, not a std::fs path.
    if (isSafPath(parent) && workspace.safTreeUri) {
      const newDocId = await safCreate(workspace.safTreeUri, fromSafPath(parent), finalName);
      editing.value = null;
      refresh.scheduleRefresh();
      await files.openPath(toSafPath(newDocId), { bypassNewWindow: true });
      return;
    }
    const target = joinPath(parent, finalName);
    // A pending delete on this exact path would fire later and take the new
    // file with it. Commit it now so the two never race.
    await pendingDeletes.flushUnder(target);
    await fsPort.fsCreateFile({ path: target, content: '' });
    editing.value = null;
    refresh.scheduleRefresh();
    await files.openPath(target, { bypassNewWindow: true });
  }

  async function commitRename(parent: string, original: string, name: string) {
    const target = joinPath(parent, name);
    if (target === original) {
      editing.value = null;
      return;
    }
    await pendingDeletes.flushUnder(target);
    await fsPort.fsRename({ from: original, to: target });
    editing.value = null;
    // #342 — a renamed child keeps its hand-placed position.
    const key = orderKey(workspace.currentFolder, parent);
    const order = manualOrder.value[key];
    if (order?.includes(baseName(original))) {
      manualOrder.value = {
        ...manualOrder.value,
        [key]: renameInOrder(order, baseName(original), name),
      };
      void sort.saveManualOrder();
    }
    refresh.scheduleRefresh();
    // v4.3.5 — if the renamed file is open in a tab, the tab follows it.
    // repointTab is shared with the move path: it keeps a dirty tab's
    // unsaved edits and reloads a clean one, which picks up any per-file
    // `.assets/` link rewrite the rename triggered (#91).
    try {
      const tab = tabs.tabs.find((t: { filePath?: string }) => t.filePath === original);
      if (tab) await repointTab(tabs, tab, target);
    } catch (err) {
      console.warn('[FileTree.rename] tab refresh failed', err);
    }
  }

  async function commitEdit() {
    const e = editing.value;
    if (!e) return;
    const name = e.name.trim();
    if (!name) {
      editing.value = null;
      return;
    }
    try {
      if (e.kind === 'new-file') {
        await commitNewFile(e.parent, name);
      } else if (e.kind === 'new-dir') {
        await pendingDeletes.flushUnder(joinPath(e.parent, name));
        await fsPort.fsCreateDir({ path: joinPath(e.parent, name) });
        editing.value = null;
        refresh.scheduleRefresh();
      } else if (e.kind === 'rename' && e.original) {
        await commitRename(e.parent, e.original, name);
      }
    } catch (err) {
      toasts.error(String(err));
    }
  }

  function cancelEdit() {
    editing.value = null;
  }

  // CJK / IME guard for the rename / new-file inline input. Mirrors the pattern
  // used by AgentPanel.vue::onKeydown — while the user is mid-composition (e.g.
  // typing pinyin and pressing Enter to commit an IME candidate), `isComposing`
  // is true (or `keyCode === 229` on older engines) and the Enter belongs to
  // the IME, not to us. Treating it as "commit" would rename/create the file
  // before the candidate is inserted.
  function onRenameKey(e: KeyboardEvent) {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      void commitEdit();
    }
  }

  return {
    editInTree, EditRowAtRoot, startNewFile, startNewFolder, startRename,
    commitEdit, cancelEdit, onRenameKey,
  };
}

export type TreeEdit = ReturnType<typeof useTreeEdit>;
