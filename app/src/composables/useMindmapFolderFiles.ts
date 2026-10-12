import { invoke } from '@tauri-apps/api/core';
import type { FileReadResult } from '../types';
import { MAX_FILE_CHARS, sortFolderFiles, type FolderFile } from '../lib/mindmap-folder';

interface DirEntry { name: string; path: string; is_dir: boolean }
interface ListResult { files: FolderFile[]; oversized: string[] }

const MAX_FILES = 500;
const HIDDEN_PREFIX = '.';
const IGNORED_DIR = 'node_modules';
const MARKDOWN_NAME = /\.(md|markdown)$/i;
const PATH_SEPARATOR = '/';

interface Candidate { absPath: string; relPath: string }

function isIgnored(entry: DirEntry): boolean {
  return entry.name.startsWith(HIDDEN_PREFIX) || entry.name === IGNORED_DIR;
}

async function collectCandidates(folder: string): Promise<Candidate[]> {
  const found: Candidate[] = [];
  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await invoke<DirEntry[]>('list_dir', { path: dir });
    for (const entry of entries) {
      if (found.length >= MAX_FILES) return;
      if (isIgnored(entry)) continue;
      const relPath = `${prefix}${entry.name}`;
      if (entry.is_dir) await walk(entry.path, `${relPath}${PATH_SEPARATOR}`);
      else if (MARKDOWN_NAME.test(entry.name)) found.push({ absPath: entry.path, relPath });
    }
  };
  await walk(folder, '');
  return found;
}

async function readCandidate(candidate: Candidate): Promise<FolderFile | null> {
  try {
    const { content } = await invoke<FileReadResult>('read_file', { path: candidate.absPath });
    return content.length > MAX_FILE_CHARS ? null : { ...candidate, text: content };
  } catch (error) {
    console.error('mindmap folder: read failed', candidate.relPath, error);
    return null;
  }
}

async function listMarkdownFiles(folder: string): Promise<ListResult> {
  const candidates = await collectCandidates(folder);
  const files: FolderFile[] = [];
  const oversized: string[] = [];
  for (const candidate of candidates) {
    const file = await readCandidate(candidate);
    if (file) files.push(file);
    else oversized.push(candidate.relPath);
  }
  return { files: sortFolderFiles(files), oversized };
}

export function useMindmapFolderFiles(): { listMarkdownFiles(folder: string): Promise<ListResult> } {
  return { listMarkdownFiles };
}
