import type { SearchOptions } from '../composables/useGlobalSearch';

/** Fired by the editor find bar when its scope is a folder; App.vue opens the
 *  search pane and hands the request to it as a preset. */
export const FOLDER_SEARCH_EVENT = 'solomd:folder-search';

export type FindScope = 'file' | 'folder' | 'all';

export interface FolderSearchRequest {
  root: string;
  query: string;
  options: SearchOptions;
  replacement: string;
  replaceOpen: boolean;
  /** Run the pane's Replace all once the preset is applied. */
  action?: 'replaceAll';
}

export interface FolderSearchPreset extends FolderSearchRequest {
  nonce: number;
}

export function parentDir(filePath: string): string {
  return filePath.replace(/[\\/][^\\/]*$/, '');
}

export function requestFolderSearch(req: FolderSearchRequest): void {
  window.dispatchEvent(new CustomEvent<FolderSearchRequest>(FOLDER_SEARCH_EVENT, { detail: req }));
}
