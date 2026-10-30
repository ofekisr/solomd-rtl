import { fsPort } from '../platform/index.ts';
import { MAX_FILE_BYTES, sortFolderFiles, type FolderFile } from '../lib/mindmap/folder';

interface DirEntry { name: string; path: string; is_dir: boolean }
interface ListResult { files: FolderFile[]; oversized: string[]; truncated: boolean }

export const MAX_FILES = 500;
const HIDDEN_PREFIX = '.';
const IGNORED_DIR = 'node_modules';
const MARKDOWN_NAME = /\.(md|markdown)$/i;
const PATH_SEPARATOR = '/';

interface Candidate { absPath: string; relPath: string }

function isIgnored(entry: DirEntry): boolean {
  return entry.name.startsWith(HIDDEN_PREFIX) || entry.name === IGNORED_DIR;
}

async function collectCandidates(folder: string): Promise<{ found: Candidate[]; truncated: boolean }> {
  const found: Candidate[] = [];
  let truncated = false;
  const walk = async (dir: string, prefix: string): Promise<void> => {
    const entries = await fsPort.listDir({ path: dir });
    for (const entry of entries) {
      if (found.length >= MAX_FILES) { truncated = true; return; }
      if (isIgnored(entry)) continue;
      const relPath = `${prefix}${entry.name}`;
      if (entry.is_dir) await walk(entry.path, `${relPath}${PATH_SEPARATOR}`);
      else if (MARKDOWN_NAME.test(entry.name)) found.push({ absPath: entry.path, relPath });
    }
  };
  await walk(folder, '');
  return { found, truncated };
}

async function readCandidate(candidate: Candidate): Promise<FolderFile | null> {
  try {
    const { content } = await fsPort.readFile({ path: candidate.absPath });
    return new TextEncoder().encode(content).length > MAX_FILE_BYTES ? null : { ...candidate, text: content };
  } catch (error) {
    console.error('mindmap folder: read failed', candidate.relPath, error);
    return null;
  }
}

async function listMarkdownFiles(folder: string): Promise<ListResult> {
  const { found: candidates, truncated } = await collectCandidates(folder);
  const files: FolderFile[] = [];
  const oversized: string[] = [];
  for (const candidate of candidates) {
    const file = await readCandidate(candidate);
    if (file) files.push(file);
    else oversized.push(candidate.relPath);
  }
  return { files: sortFolderFiles(files), oversized, truncated };
}

export function useMindmapFolderFiles(): { listMarkdownFiles(folder: string): Promise<ListResult> } {
  return { listMarkdownFiles };
}
