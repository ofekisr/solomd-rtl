import { countLines, listSourceFiles, readRepoFile } from './scan.ts';

export interface SizeBudget {
  readonly root: string;
  readonly ext: string;
  readonly maxLines: number;
}

export type FileSizeSlice = Record<string, number>;

export const SIZE_BUDGETS: readonly SizeBudget[] = [
  { root: 'app/src', ext: '.ts', maxLines: 400 },
  { root: 'app/src', ext: '.vue', maxLines: 500 },
  { root: 'app/src-tauri/src', ext: '.rs', maxLines: 600 },
  { root: 'plugins/solomd-mindmap/server/src', ext: '.ts', maxLines: 400 },
];

export function collectFileSize(repoRoot: string): FileSizeSlice {
  const over: FileSizeSlice = {};
  for (const budget of SIZE_BUDGETS) {
    for (const path of listSourceFiles(repoRoot, [budget.root], [budget.ext])) {
      const lineCount = countLines(readRepoFile(repoRoot, path));
      if (lineCount > budget.maxLines) over[path] = lineCount;
    }
  }
  return over;
}

export function checkFileSize(current: FileSizeSlice, baseline: Readonly<FileSizeSlice>): string[] {
  return Object.entries(current).flatMap(([path, lineCount]) => {
    const allowed = baseline[path];
    if (allowed === undefined) return [newFileMessage(path, lineCount)];
    return lineCount > allowed ? [grewMessage(path, lineCount, allowed)] : [];
  });
}

function budgetFor(path: string): number {
  const budget = SIZE_BUDGETS.find((b) => path.startsWith(`${b.root}/`) && path.endsWith(b.ext));
  return budget?.maxLines ?? 0;
}

function grewMessage(path: string, lineCount: number, allowed: number): string {
  return `[arch:file-size] ${path} has ${lineCount} lines; baseline ${allowed}. Shrink it, or split before adding. See app/arch/CLAUDE.md.`;
}

function newFileMessage(path: string, lineCount: number): string {
  return `[arch:file-size] ${path} has ${lineCount} lines; budget ${budgetFor(path)}. Split it into smaller files. See app/arch/CLAUDE.md.`;
}
