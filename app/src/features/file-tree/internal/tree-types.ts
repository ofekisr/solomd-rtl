export interface TreeEntry {
  name: string;
  path: string;
  is_dir: boolean;
  modified?: number;
  created?: number;
}

export interface TreeNode extends TreeEntry {
  expanded?: boolean;
  children?: TreeNode[];
  loading?: boolean;
  /** True when the directory had more children than we serialized — surface
   *  a "+N more" hint instead of silently hiding files. */
  truncated?: boolean;
}

export interface TreeSelection {
  path: string;
  isDir: boolean;
}

export interface CtxMenu {
  x: number;
  y: number;
  /** null = clicked the workspace root (no node) */
  node: TreeNode | null;
}

export type InlineEditKind = 'new-file' | 'new-dir' | 'rename';

export interface InlineEdit {
  kind: InlineEditKind;
  /** For "new", this is the parent dir; for rename, the target's parent. */
  parent: string;
  /** For rename only — the original full path. */
  original?: string;
  /** Editable name (defaults to a sensible placeholder). */
  name: string;
}
