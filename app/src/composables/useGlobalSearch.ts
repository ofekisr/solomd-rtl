import { invoke } from '@tauri-apps/api/core';
import { useWorkspaceStore } from '../stores/workspace';
import { useToastsStore } from '../stores/toasts';

export interface SearchHit {
  file: string;
  line: number;
  snippet: string;
  /** UTF-16 `[start, end)` match spans inside `snippet`. */
  ranges: Array<[number, number]>;
  /** `snippet` with the replacement applied, when one was requested. */
  preview?: string | null;
}

export interface SearchOptions {
  regex: boolean;
  caseSensitive: boolean;
}

export interface SearchExtras {
  options?: SearchOptions;
  replacement?: string;
}

export type SearchOutcome = { hits: SearchHit[]; error: string | null };

const DEFAULT_MAX_RESULTS = 200;

export function useGlobalSearch() {
  const workspace = useWorkspaceStore();
  const toasts = useToastsStore();

  async function run(
    query: string,
    root?: string,
    maxResults = DEFAULT_MAX_RESULTS,
    extras: SearchExtras = {},
  ): Promise<SearchOutcome> {
    const folder = root ?? workspace.currentFolder;
    if (!folder) return { hits: [], error: 'Open a folder first to enable global search' };
    if (!query.trim()) return { hits: [], error: null };
    try {
      const hits = await invoke<SearchHit[]>('search_in_dir', {
        root: folder,
        query,
        maxResults,
        options: extras.options ?? null,
        replacement: extras.replacement ?? null,
      });
      return { hits, error: null };
    } catch (e) {
      return { hits: [], error: String(e) };
    }
  }

  async function search(
    query: string,
    root?: string,
    maxResults = DEFAULT_MAX_RESULTS,
    extras: SearchExtras = {},
  ): Promise<SearchHit[]> {
    const { hits, error } = await run(query, root, maxResults, extras);
    if (error) toasts.error(`Search failed: ${error}`);
    return hits;
  }

  return { search, run };
}
