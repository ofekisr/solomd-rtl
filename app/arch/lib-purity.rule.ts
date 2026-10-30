import { extractImports, listSourceFiles, readRepoFile } from './scan.ts';

const LIB_ROOTS: readonly string[] = ['app/src/lib'];
const LIB_EXTS: readonly string[] = ['.ts', '.vue'];
const FRAMEWORK_EXACT = new Set(['vue', 'pinia']);
const FRAMEWORK_PREFIXES: readonly string[] = ['vue/', '@tauri-apps/'];

export function isFrameworkImport(specifier: string): boolean {
  return FRAMEWORK_EXACT.has(specifier) || FRAMEWORK_PREFIXES.some((prefix) => specifier.startsWith(prefix));
}

export function collectLibPurity(repoRoot: string): string[] {
  return listSourceFiles(repoRoot, LIB_ROOTS, LIB_EXTS)
    .filter((path) => extractImports(readRepoFile(repoRoot, path)).some(isFrameworkImport));
}

export function checkLibPurity(current: readonly string[], baseline: readonly string[]): string[] {
  const allowed = new Set(baseline);
  return current.filter((path) => !allowed.has(path)).map(libPurityMessage);
}

function libPurityMessage(path: string): string {
  return `[arch:lib-purity] ${path} imports vue, pinia or @tauri-apps/*. lib/ is pure TS: move that call into a store, composable or component. See app/arch/CLAUDE.md.`;
}
