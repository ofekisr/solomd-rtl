import { extractImports, listSourceFiles, readRepoFile } from './scan.ts';

export const RAW_IPC_MODULE = '@tauri-apps/api/core';

const RAW_IPC_ROOTS: readonly string[] = ['app/src'];
const RAW_IPC_EXTS: readonly string[] = ['.ts', '.vue'];

export function collectRawIpc(repoRoot: string): string[] {
  return listSourceFiles(repoRoot, RAW_IPC_ROOTS, RAW_IPC_EXTS)
    .filter((path) => extractImports(readRepoFile(repoRoot, path), path).includes(RAW_IPC_MODULE));
}

export function checkRawIpc(current: readonly string[], baseline: readonly string[]): string[] {
  const allowed = new Set(baseline);
  return current.filter((path) => !allowed.has(path)).map(rawIpcMessage);
}

function rawIpcMessage(path: string): string {
  return `[arch:raw-ipc] ${path} imports ${RAW_IPC_MODULE}. New raw IPC is frozen: call it from an already-baselined file, or from app/src/platform/ once it exists (Wave 1). See app/arch/CLAUDE.md.`;
}
