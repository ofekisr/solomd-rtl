import { ref } from 'vue';
import type { CtxMenu, InlineEdit, TreeNode, TreeSelection } from './tree-types.ts';

/**
 * State shared by the file-tree composables. `FileTree.vue` calls this once
 * and hands the object to each composable (not module singletons: the tree
 * could mount twice in a split view).
 */
export function createFileTreeState() {
  const root = ref<TreeNode | null>(null);
  const selected = ref<TreeSelection | null>(null);
  const ctx = ref<CtxMenu | null>(null);
  const isNewFileSubOpen = ref(false);
  const editing = ref<InlineEdit | null>(null);
  const editInput = ref<HTMLInputElement | null>(null);
  const treeBody = ref<HTMLElement | null>(null);
  const rootMissing = ref(false);
  const sortOpen = ref(false);
  const filterOpen = ref(false);
  const manualOrder = ref<Record<string, string[]>>({});

  function findNode(path: string, nodes?: TreeNode[]): TreeNode | null {
    for (const n of nodes ?? root.value?.children ?? []) {
      if (n.path === path) return n;
      if (n.children) {
        const hit = findNode(path, n.children);
        if (hit) return hit;
      }
    }
    return null;
  }

  return {
    root, selected, ctx, isNewFileSubOpen, editing, editInput, treeBody,
    rootMissing, sortOpen, filterOpen, manualOrder, findNode,
  };
}

export type FileTreeState = ReturnType<typeof createFileTreeState>;
