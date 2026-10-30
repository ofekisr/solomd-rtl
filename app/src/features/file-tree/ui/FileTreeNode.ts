import { defineComponent, h, inject, type PropType, type VNode } from 'vue';
import { useSettingsStore } from '../../../stores/settings';
import {
  dragPath,
  dropTarget,
  reorderTarget,
  suppressClick,
} from '../internal/useTreeDrag.ts';
import { revealedPath } from '../internal/useFileTreeReveal.ts';
import { FTREE_EDIT, INDENT_BASE, INDENT_STEP, indentGuides, type FtreeEditApi } from '../internal/useTreeRender.ts';
import type { TreeNode } from '../internal/tree-types.ts';

type ToggleHow = 'click' | 'dblclick';

const FILE_ICONS: Record<string, string> = {
  // Notes & docs — the markdown family is unified on one glyph so a
  // vault of .md / .markdown / .mdx reads as one consistent type.
  'md': '📝', 'markdown': '📝', 'mdx': '📝', 'org': '📝',
  'txt': '📄', 'text': '📄', 'rtf': '📄', 'tex': '📄',
  'pdf': '📕', 'epub': '📖',
  'doc': '📘', 'docx': '📘',
  'ppt': '📙', 'pptx': '📙', 'key': '📙',
  'xls': '📊', 'xlsx': '📊', 'csv': '📊', 'tsv': '📊',
  'canvas': '🗺', 'bib': '📚',
  'mmap': '🧠', 'xmind': '🧠',
  // Images
  'jpg': '🖼', 'jpeg': '🖼', 'png': '🖼', 'gif': '🖼',
  'webp': '🖼', 'svg': '🖼', 'ico': '🖼', 'bmp': '🖼', 'avif': '🖼',
  // Audio / video
  'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'm4a': '🎵', 'aac': '🎵', 'ogg': '🎵',
  'mp4': '🎬', 'mov': '🎬', 'avi': '🎬', 'mkv': '🎬', 'webm': '🎬',
  // Archives
  'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
  // Data & config
  'json': '📋', 'xml': '📋', 'yaml': '📋', 'yml': '📋',
  'toml': '📋', 'ini': '📋', 'cfg': '📋', 'conf': '📋',
  'log': '📋', 'sql': '🗃', 'db': '🗃', 'sqlite': '🗃',
  'env': '🔑', 'lock': '🔒',
  // Web & code
  'html': '🌐', 'htm': '🌐',
  'css': '🎨', 'scss': '🎨', 'less': '🎨',
  'js': '📜', 'mjs': '📜', 'cjs': '📜', 'jsx': '📜',
  'ts': '📜', 'tsx': '📜', 'vue': '💚',
  'py': '🐍', 'java': '☕', 'rb': '💎', 'php': '🐘',
  'c': '⚙', 'h': '⚙', 'cpp': '⚙', 'cc': '⚙', 'hpp': '⚙',
  'go': '🐹', 'rs': '🦀',
  'sh': '🐚', 'bash': '🐚', 'zsh': '🐚',
  // Extension-less well-known names (split('.').pop() returns the name)
  'makefile': '🔧', 'dockerfile': '🐳', 'license': '📜', 'gitignore': '🚫',
};

const DEFAULT_FILE_ICON = '📄';

// The extension the way `Path::extension()` sees it, so the tree filter
// and the backend's extension index agree: no dot, lower-cased, and a
// leading-dot name like `.gitignore` has NO extension (it's all stem).
const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
};

const getFileIcon = (name: string): string => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return FILE_ICONS[ext] || DEFAULT_FILE_ICON;
};

// #259 — split "name" and ".ext" so CSS can truncate the name to whatever
// width the sidebar has, keeping the extension visible. This used to be a
// fixed 30-character cut in JS, so widening the sidebar never showed more.
const splitName = (name: string): [string, string] => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
};

export const FileTreeNode = defineComponent({
  name: 'FileTreeNode',
  props: {
    node: { type: Object as PropType<TreeNode>, required: true },
    depth: { type: Number, default: 0 },
    /** Path of the selected row, so FileTreeNode can tint it without holding
     *  any selection state of its own. */
    selectedPath: { type: String, default: '' },
    inboxOnly: { type: Boolean, default: false },
    inboxPaths: { type: Object as PropType<Set<string>>, default: () => new Set<string>() },
    /** #282 — lower-case extensions without the dot ('' = no extension).
     *  Empty means no filtering. */
    extFilter: { type: Array as PropType<string[]>, default: () => [] },
    /** Absolute paths of folders whose subtree holds a match, or null when
     *  no filter is active (or the backend walk failed — we fail open). */
    filterDirs: { type: Object as PropType<Set<string> | null>, default: null },
  },
  emits: ['toggle', 'contextmenu', 'press'],
  setup(props, { emit }) {
    // #182 — the full-names toggle lives in settings; this inner component is
    // module-scoped so it can't close over FileTree's store instance.
    const nodeSettings = useSettingsStore();
    const edit = inject<FtreeEditApi | null>(FTREE_EDIT, null);
    const subtreeHasInbox = (node: TreeNode): boolean => {
      if (!node.is_dir) return props.inboxPaths.has(node.path);
      if (!node.children) return false;
      return node.children.some(subtreeHasInbox);
    };

    const isHiddenByFilters = (n: TreeNode): boolean => {
      if (props.inboxOnly) {
        if (!n.is_dir && !props.inboxPaths.has(n.path)) return true;
        if (n.is_dir && n.children && !subtreeHasInbox(n)) return true;
      }
      if (props.extFilter.length) {
        if (!n.is_dir) {
          if (!props.extFilter.includes(extensionOf(n.name))) return true;
        } else if (props.filterDirs && !props.filterDirs.has(n.path)) {
          return true;
        }
      }
      return false;
    };

    const nameNodeFor = (n: TreeNode): VNode => {
      // Full name in the tooltip. #182 — the full-names setting wraps
      // instead of truncating.
      const [nameBase, nameExt] = splitName(n.name);
      if (!n.is_dir && !nodeSettings.explorerFullNames && nameExt) {
        return h('span', { class: 'ftree__name ftree__name--split' }, [
          h('span', { class: 'ftree__name-base' }, nameBase),
          h('span', { class: 'ftree__name-ext' }, nameExt),
        ]);
      }
      return h('span', { class: 'ftree__name' }, n.name);
    };

    const rowFor = (n: TreeNode): VNode => {
      const indent = INDENT_BASE + props.depth * INDENT_STEP;
      return h(
        'li',
        {
          class: [
            'ftree__item',
            n.is_dir ? 'ftree__item--dir' : 'ftree__item--file',
            props.selectedPath === n.path ? 'ftree__item--selected' : '',
            dragPath.value === n.path ? 'ftree__item--dragging' : '',
            n.is_dir && dropTarget.value === n.path ? 'ftree__item--drop' : '',
            revealedPath.value === n.path ? 'ftree__item--revealed' : '',
            reorderTarget.value && reorderTarget.value.path === n.path ? `ftree__item--insert-${reorderTarget.value.pos}` : '',
          ],
          style: { paddingLeft: indent + 'px' },
          // Hit-testing during a drag reads these off whatever row is under
          // the pointer, so the drag logic never has to walk the tree.
          'data-path': n.path,
          'data-dir': n.is_dir ? '1' : '0',
          onPointerdown: (e: PointerEvent) => emit('press', e, n),
          onClick: () => {
            // Swallow the click that ends a drag, or dropping a file would
            // also open it and dropping a folder would toggle it.
            if (suppressClick.value) {
              suppressClick.value = false;
              return;
            }
            emit('toggle', n, 'click');
          },
          onDblclick: () => emit('toggle', n, 'dblclick'),
          onContextmenu: (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            emit('contextmenu', e, n);
          },
          title: n.path,
        },
        [
          ...indentGuides(props.depth),
          // #338 — a folder row is caret + folder glyph; a file row keeps the
          // caret column empty, so its icon lines up with the folder glyph
          // and every file sits visibly to the right of the folders at its
          // level (the file emoji used to be further left than the folder's
          // small caret, which read as "files are the parents").
          h('span', { class: ['ftree__caret', n.is_dir && n.expanded ? 'ftree__caret--open' : ''] }, n.is_dir ? '›' : ''),
          h('span', { class: 'ftree__icon' }, n.is_dir ? (n.expanded ? '📂' : '📁') : getFileIcon(n.name)),
          nameNodeFor(n),
          !n.is_dir && props.inboxPaths.has(n.path)
            ? h('span', { class: 'ftree__inbox-dot', title: 'inbox' }, '●')
            : null,
        ],
      );
    };

    return () => {
      const n = props.node;
      if (isHiddenByFilters(n)) return [];
      const e = edit?.editInTree.value ? edit.editing.value : null;
      const renaming = !!e && e.kind === 'rename' && e.original === n.path;
      const items: Array<VNode | null> = [renaming ? edit!.renderEditRow(props.depth) : rowFor(n)];
      if (n.is_dir && n.expanded && n.children) {
        for (const c of n.children) {
          items.push(
            h(FileTreeNode, {
              node: c,
              depth: props.depth + 1,
              selectedPath: props.selectedPath,
              inboxOnly: props.inboxOnly,
              inboxPaths: props.inboxPaths,
              extFilter: props.extFilter,
              filterDirs: props.filterDirs,
              onToggle: (target: TreeNode, how?: ToggleHow) => emit('toggle', target, how),
              onContextmenu: (event: MouseEvent, target: TreeNode) => emit('contextmenu', event, target),
              onPress: (event: PointerEvent, target: TreeNode) => emit('press', event, target),
            }),
          );
        }
        // #321 — a new entry being named goes at the end of its folder.
        if (e && e.kind !== 'rename' && e.parent === n.path) items.push(edit!.renderEditRow(props.depth + 1));
      }
      return items;
    };
  },
});
