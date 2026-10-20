import type { MindElixirData, NodeObj } from 'mind-elixir';
import { isRecord } from './mindmap-gates.ts';
import { sanitizeMindmapData } from './mindmap-format.ts';
import { isPathIncluded, joinPath, type ScopeRules } from './mindmap-folder-scope.ts';

export interface ScannedFolder { name: string; relPath: string; files: string[]; folders: ScannedFolder[] }
export interface TagRule { suffix: string; tag: string }
export interface TreeEntry { name: string; relPath: string; isDir: boolean }
export interface TreeRow extends TreeEntry { depth: number; isHidden: boolean; isExpanded: boolean }

export interface TreeOptions {
  scope: ScopeRules;
  wrapFiles: boolean;
  tagRules: readonly TagRule[];
  filesTopic(count: number): string;
}

const ROOT_ID = 'root';
const ROOT_PATH = '';
const NODE_ID_PREFIX = 't';
const HIDDEN_PREFIX = '.';

export function visibleRows(
  rootName: string, children: ReadonlyMap<string, readonly TreeEntry[]>, expanded: ReadonlySet<string>, showHidden: boolean,
): TreeRow[] {
  const rows: TreeRow[] = [];
  const add = (entry: TreeEntry, depth: number): void => {
    const isHidden = entry.name.startsWith(HIDDEN_PREFIX);
    if (isHidden && !showHidden && depth > 0) return;
    const isExpanded = entry.isDir && expanded.has(entry.relPath);
    rows.push({ ...entry, depth, isHidden, isExpanded });
    if (isExpanded) (children.get(entry.relPath) ?? []).forEach((child) => add(child, depth + 1));
  };
  add({ name: rootName, relPath: ROOT_PATH, isDir: true }, 0);
  return rows;
}

export function rowRange(rows: readonly TreeRow[], anchor: string, target: string): TreeRow[] {
  const from = rows.findIndex((row) => row.relPath === anchor);
  const to = rows.findIndex((row) => row.relPath === target);
  if (from < 0 || to < 0) return rows.filter((row) => row.relPath === target);
  return rows.slice(Math.min(from, to), Math.max(from, to) + 1);
}

export function matchingTags(fileNames: readonly string[], rules: readonly TagRule[]): string[] {
  const tags = new Set<string>();
  for (const rule of rules) {
    if (rule.suffix === '' || rule.tag === '') continue;
    const suffix = rule.suffix.toLowerCase();
    if (fileNames.some((name) => name.toLowerCase().endsWith(suffix))) tags.add(rule.tag);
  }
  return [...tags];
}

export function parseTagRules(input: unknown): TagRule[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!isRecord(item) || typeof item.suffix !== 'string' || typeof item.tag !== 'string') return [];
    const suffix = item.suffix.trim();
    const tag = item.tag.trim();
    return suffix && tag ? [{ suffix, tag }] : [];
  });
}

class TreeBuilder {
  private nextId = 0;
  private readonly options: TreeOptions;

  constructor(options: TreeOptions) {
    this.options = options;
  }

  build(root: ScannedFolder): MindElixirData {
    const node = this.folderNode(root, true) ?? { id: ROOT_ID, topic: root.name };
    return sanitizeMindmapData({ nodeData: { ...node, id: ROOT_ID } });
  }

  private id(): string {
    this.nextId += 1;
    return `${NODE_ID_PREFIX}${this.nextId}`;
  }

  private folderNode(folder: ScannedFolder, isRoot = false): NodeObj | null {
    const scope = this.options.scope;
    const fileNames = folder.files.filter((name) => isPathIncluded(joinPath(folder.relPath, name), false, scope));
    const subfolders = folder.folders.flatMap((sub) => this.folderNode(sub) ?? []);
    const isIncluded = isPathIncluded(folder.relPath, true, scope);
    if (!isRoot && !isIncluded && fileNames.length === 0 && subfolders.length === 0) return null;
    const node: NodeObj = { id: this.id(), topic: folder.name };
    const children = this.childNodes(fileNames, subfolders);
    if (children.length > 0) node.children = children;
    const tags = matchingTags(fileNames, this.options.tagRules);
    if (tags.length > 0) node.tags = tags;
    return node;
  }

  private childNodes(fileNames: string[], subfolders: NodeObj[]): NodeObj[] {
    const files = fileNames.map((name) => ({ id: this.id(), topic: name }));
    if (!this.options.wrapFiles) return [...subfolders, ...files];
    if (files.length === 0) return subfolders;
    const wrapper: NodeObj = { id: this.id(), topic: this.options.filesTopic(files.length), children: files };
    return [wrapper, ...subfolders];
  }
}

export function buildFolderTreeMap(root: ScannedFolder, options: TreeOptions): MindElixirData {
  return new TreeBuilder(options).build(root);
}
