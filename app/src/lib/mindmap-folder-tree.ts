import type { MindElixirData, NodeObj } from 'mind-elixir';
import { isRecord } from './mindmap-gates.ts';
import { sanitizeMindmapData } from './mindmap-format.ts';

export interface ScannedFile { name: string; isHidden: boolean }
export interface ScannedFolder { name: string; relPath: string; isHidden: boolean; files: ScannedFile[]; folders: ScannedFolder[] }
export interface TagRule { suffix: string; tag: string }
export interface FolderRow { relPath: string; name: string; depth: number; isHidden: boolean }

export interface TreeOptions {
  included: ReadonlySet<string>;
  wrapFiles: boolean;
  showHidden: boolean;
  rules: readonly TagRule[];
  filesTopic(count: number): string;
}

const ROOT_ID = 'root';
const NODE_ID_PREFIX = 't';

export function defaultIncluded(root: ScannedFolder): Set<string> {
  return new Set(folderRows(root, false).map((row) => row.relPath));
}

export function folderRows(root: ScannedFolder, showHidden: boolean): FolderRow[] {
  const rows: FolderRow[] = [];
  const walk = (folder: ScannedFolder, depth: number): void => {
    if (folder.isHidden && !showHidden && depth > 0) return;
    rows.push({ relPath: folder.relPath, name: folder.name, depth, isHidden: folder.isHidden });
    folder.folders.forEach((sub) => walk(sub, depth + 1));
  };
  walk(root, 0);
  return rows;
}

function findFolder(folder: ScannedFolder, relPath: string): ScannedFolder | undefined {
  if (folder.relPath === relPath) return folder;
  for (const sub of folder.folders) {
    const found = findFolder(sub, relPath);
    if (found) return found;
  }
  return undefined;
}

export function setIncluded(
  root: ScannedFolder, included: ReadonlySet<string>, relPath: string,
  isIncluded: boolean, isRecursive: boolean, showHidden = false,
): Set<string> {
  const next = new Set(included);
  const target = findFolder(root, relPath);
  if (!target) return next;
  const paths = isRecursive ? folderRows({ ...target, isHidden: false }, showHidden).map((r) => r.relPath) : [relPath];
  paths.forEach((path) => (isIncluded ? next.add(path) : next.delete(path)));
  return next;
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
    const node = this.folderNode(root);
    return sanitizeMindmapData({ nodeData: { ...node, id: ROOT_ID } });
  }

  private id(): string {
    this.nextId += 1;
    return `${NODE_ID_PREFIX}${this.nextId}`;
  }

  private isVisible(entry: { isHidden: boolean }): boolean {
    return this.options.showHidden || !entry.isHidden;
  }

  private nodesFor(folder: ScannedFolder): NodeObj[] {
    if (!this.isVisible(folder)) return [];
    if (this.options.included.has(folder.relPath)) return [this.folderNode(folder)];
    return folder.folders.flatMap((sub) => this.nodesFor(sub));
  }

  private folderNode(folder: ScannedFolder): NodeObj {
    const fileNames = folder.files.filter((f) => this.isVisible(f)).map((f) => f.name);
    const subfolders = folder.folders.flatMap((sub) => this.nodesFor(sub));
    const node: NodeObj = { id: this.id(), topic: folder.name, children: [...this.fileNodes(fileNames, subfolders)] };
    const tags = matchingTags(fileNames, this.options.rules);
    if (tags.length > 0) node.tags = tags;
    if (node.children?.length === 0) delete node.children;
    return node;
  }

  private fileNodes(fileNames: string[], subfolders: NodeObj[]): NodeObj[] {
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
