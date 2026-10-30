import { extractImports, listSourceFiles, readRepoFile } from './scan.ts';

export const RAW_IPC_PREFIX = '@tauri-apps/';

const RAW_IPC_ROOTS: readonly string[] = ['app/src'];
const RAW_IPC_EXTS: readonly string[] = ['.ts', '.vue'];
const PLATFORM_DIR = 'app/src/platform/';

export function collectRawIpc(repoRoot: string): string[] {
  return listSourceFiles(repoRoot, RAW_IPC_ROOTS, RAW_IPC_EXTS)
    .filter((path) => !path.startsWith(PLATFORM_DIR))
    .filter((path) => extractImports(readRepoFile(repoRoot, path), path).some((specifier) => specifier.startsWith(RAW_IPC_PREFIX)));
}

export function checkRawIpc(current: readonly string[], baseline: readonly string[]): string[] {
  const allowed = new Set(baseline);
  return current.filter((path) => !allowed.has(path)).map(rawIpcMessage);
}

function rawIpcMessage(path: string): string {
  return `[arch:raw-ipc] ${path} imports ${RAW_IPC_PREFIX}*. Only app/src/platform/ may import Tauri: call a port from app/src/platform/index.ts instead. See app/src/platform/CLAUDE.md.`;
}
