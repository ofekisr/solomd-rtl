import { parentDir } from './useTreeDrag.ts';

export interface ReorderTarget {
  path: string;
  pos: 'before' | 'after';
}

export interface RowProbe {
  path: string;
  isDir: boolean;
  /** Vertical position of the pointer inside the row, 0 (top) to 1 (bottom). */
  frac: number;
}

export type DestinationProbe =
  | { kind: 'row'; path: string; isDir: boolean }
  | { kind: 'root-area' }
  | null;

const DIR_EDGE_BAND = 0.25;
const FILE_SPLIT = 0.5;

export function reorderFor(row: RowProbe | null, from: string, fromIsDir: boolean): ReorderTarget | null {
  if (!row || !row.path || row.path === from) return null;
  if (row.isDir !== fromIsDir) return null;
  if (parentDir(row.path) !== parentDir(from)) return null;
  if (!row.isDir) return { path: row.path, pos: row.frac < FILE_SPLIT ? 'before' : 'after' };
  if (row.frac < DIR_EDGE_BAND) return { path: row.path, pos: 'before' };
  if (row.frac > 1 - DIR_EDGE_BAND) return { path: row.path, pos: 'after' };
  return null;
}

export function destinationFor(probe: DestinationProbe, rootPath: string | undefined): string | null {
  if (!probe) return null;
  if (probe.kind === 'row') return probe.isDir ? probe.path : null;
  return rootPath ?? null;
}
