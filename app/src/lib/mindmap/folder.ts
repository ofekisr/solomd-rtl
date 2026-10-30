import type { MindElixirData, NodeObj } from 'mind-elixir';
import { linesOutsideFences } from './md-scan.ts';
import { markdownToMindmap } from './convert.ts';
import { mergeMindmaps, type MergeEntry } from './merge.ts';
import { toWorkspaceRelative } from './source.ts';
import { rootTopicFromFileName, sanitizeMindmapData } from './format.ts';

export interface FolderFile { absPath: string; relPath: string; text: string }
export interface FolderPick { file: FolderFile; title: string; skippedByDirective: boolean }

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const NODE_WARNING_THRESHOLD = 5000;

const KEYWORD_SEPARATOR = ',';
const PAIR_SEPARATOR = '=';
const PATH_SEPARATOR = '/';
const SKIP_PAIR = 'skip=true';
const EPUB_DIRECTIVE = /^\s*<!--\s*epub:\s*(.*?)\s*-->\s*$/;
const REGEX_META = /[.*+?^${}()|[\]\\]/g;
const WORD_BEFORE = '(?<![\\p{L}\\p{N}_])';
const WORD_AFTER = '(?![\\p{L}\\p{N}_])';

export function sortFolderFiles(files: FolderFile[]): FolderFile[] {
  return [...files].sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));
}

export function parseSkipKeywords(input: string): string[] {
  const seen = new Set<string>();
  return input
    .split(KEYWORD_SEPARATOR)
    .map((word) => word.trim())
    .filter((word) => {
      const key = word.toLowerCase();
      if (word === '' || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function matchesSkipKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((word) => {
    const escaped = word.replace(REGEX_META, '\\$&');
    return new RegExp(`${WORD_BEFORE}${escaped}${WORD_AFTER}`, 'iu').test(text);
  });
}

function directivePairs(body: string): string[] {
  return body.split(KEYWORD_SEPARATOR).map((pair) => pair.split(PAIR_SEPARATOR).map((part) => part.trim()).join(PAIR_SEPARATOR));
}

export function hasEpubSkip(text: string): boolean {
  return linesOutsideFences(text).some(({ text: line }) => {
    const body = EPUB_DIRECTIVE.exec(line)?.[1];
    return body !== undefined && directivePairs(body).includes(SKIP_PAIR);
  });
}

export function fileTitle(file: FolderFile): string {
  return markdownToMindmap(file.text, { rootTopic: rootTopicFromFileName(file.relPath) }).nodeData.topic;
}

export function subfolderOf(relPath: string): string | undefined {
  const cut = relPath.lastIndexOf(PATH_SEPARATOR);
  return cut < 0 ? undefined : relPath.slice(0, cut);
}

interface BuildOptions { groupBySubfolder: boolean; workspaceRoot: string | null }

function entryFor(file: FolderFile, options: BuildOptions): MergeEntry {
  const path = options.workspaceRoot ? toWorkspaceRelative(file.absPath, options.workspaceRoot) : undefined;
  const data = markdownToMindmap(file.text, { rootTopic: rootTopicFromFileName(file.relPath), path });
  return { data, group: options.groupBySubfolder ? subfolderOf(file.relPath) : undefined };
}

export function buildFolderMap(folderName: string, files: FolderFile[], options: BuildOptions): MindElixirData {
  return sanitizeMindmapData(mergeMindmaps(folderName, files.map((file) => entryFor(file, options))));
}

function countNode(node: NodeObj): number {
  return (node.children ?? []).reduce((sum, child) => sum + countNode(child), 1);
}

export function countNodes(data: MindElixirData): number {
  return countNode(data.nodeData);
}
