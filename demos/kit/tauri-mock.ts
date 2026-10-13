import type { Page } from '@playwright/test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const CONTENT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const BINARY_EXTENSIONS = ['.xmind'];
export const VAULT_ROOT = '/Users/demo/פרויקט';

export interface FakeBackend {
  files: Record<string, string>;
  binaryFiles: Record<string, string>;
  dirs: string[];
  pickedFolder: string;
  directiveManifests: unknown[];
}

function collect(dir: string, virtualDir: string, backend: FakeBackend): void {
  backend.dirs.push(virtualDir);
  for (const name of readdirSync(dir)) {
    const real = path.join(dir, name);
    const virtual = `${virtualDir}/${name}`;
    if (statSync(real).isDirectory()) collect(real, virtual, backend);
    else if (BINARY_EXTENSIONS.includes(path.extname(name))) backend.binaryFiles[virtual] = readFileSync(real).toString('base64');
    else backend.files[virtual] = readFileSync(real, 'utf8');
  }
}

export function vaultBackend(vaultDir: string, manifestFiles: string[] = []): FakeBackend {
  const backend: FakeBackend = { files: {}, binaryFiles: {}, dirs: [], pickedFolder: VAULT_ROOT, directiveManifests: [] };
  collect(path.join(CONTENT_DIR, vaultDir), VAULT_ROOT, backend);
  backend.directiveManifests = manifestFiles.map((f) => JSON.parse(readFileSync(path.join(CONTENT_DIR, f), 'utf8')));
  return backend;
}

/**
 * Runs in the page: a stand-in for the Tauri IPC bridge so desktop-only flows
 * (Open Folder, file tree, read_file, directive manifests) work in the web build.
 * Unknown commands resolve to null, which every caller already treats as "not available".
 */
function installTauriMock(backend: FakeBackend): void {
  const LANGUAGE_BY_EXT: Record<string, string> = {
    md: 'markdown', mmap: 'mindmap', py: 'python', pyj: 'python', ts: 'typescript',
    js: 'javascript', sh: 'bash', json: 'json',
  };
  const callbacks = new Map<number, (payload: unknown) => void>();
  let nextCallbackId = 1;
  const childrenOf = (dir: string) => {
    const prefix = `${dir}/`;
    const names = new Set<string>();
    for (const p of [...Object.keys(backend.files), ...Object.keys(backend.binaryFiles), ...backend.dirs]) {
      if (p.startsWith(prefix)) names.add(p.slice(prefix.length).split('/')[0]);
    }
    return [...names].sort().map((name) => {
      const full = prefix + name;
      return { name, path: full, is_dir: backend.dirs.includes(full), modified: 0, created: 0 };
    });
  };
  const readFile = (p: string) => {
    const content = backend.files[p];
    if (content === undefined) throw new Error(`No such file: ${p}`);
    const ext = p.split('.').pop()?.toLowerCase() ?? '';
    return { content, encoding: 'UTF-8', language: LANGUAGE_BY_EXT[ext] ?? 'plaintext', had_bom: false };
  };
  const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
    'plugin:dialog|open': () => backend.pickedFolder,
    'plugin:fs|exists': (a) => {
      const p = String(a.path ?? '');
      return p in backend.files || backend.dirs.includes(p);
    },
    'plugin:dialog|save': (a) => {
      const options = (a.options ?? {}) as { defaultPath?: string };
      const name = (options.defaultPath ?? 'export.md').split('/').pop();
      return `${backend.pickedFolder}/${name}`;
    },
    'plugin:path|resolve_directory': () => '/Users/demo/Documents',
    fs_file_exists: (a) => String(a.path) in backend.files,
    read_binary_file: (a) => Array.from(atob(backend.binaryFiles[String(a.path)] ?? ''), (ch) => ch.charCodeAt(0)),
    fs_create_file: (a) => {
      backend.files[String(a.path)] = String(a.content ?? '');
      return null;
    },
    write_file: (a) => {
      backend.files[String(a.path)] = String(a.content ?? '');
      return null;
    },
    'plugin:event|listen': () => nextCallbackId++,
    'plugin:event|unlisten': () => null,
    fs_dir_exists: (a) => backend.dirs.includes(String(a.path)),
    workspace_index_init: () => Object.keys(backend.files).length,
    workspace_index_files: () => [],
    workspace_index_tags: () => [],
    workspace_index_backlinks: () => [],
    session_list_others: () => [],
    spellcheck_list_dicts: () => [],
    list_dir: (a) => childrenOf(String(a.path)),
    read_file: (a) => readFile(String(a.path)),
    directive_completions_load: () => ({
      directory: '/Users/demo/.solomd/completions',
      manifests: backend.directiveManifests,
      warnings: [],
    }),
  };
  const w = window as unknown as Record<string, unknown>;
  w.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
    transformCallback(cb: (payload: unknown) => void) {
      const id = nextCallbackId++;
      callbacks.set(id, cb);
      return id;
    },
    unregisterCallback(id: number) {
      callbacks.delete(id);
    },
    convertFileSrc: (p: string) => p,
    async invoke(cmd: string, args: Record<string, unknown> = {}) {
      const handler = handlers[cmd];
      if (!handler) (w.__demoUnknownCommands as string[]).push(cmd);
      return handler ? handler(args) : null;
    },
  };
  w.__demoUnknownCommands = [];
  w.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener() {} };
}

export async function useFakeBackend(page: Page, backend: FakeBackend): Promise<void> {
  await page.addInitScript(installTauriMock, backend);
}
