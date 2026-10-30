import { convertFileSrc as coreConvertFileSrc } from '@tauri-apps/api/core';
import * as pathModule from '@tauri-apps/api/path';
import type { PathPort } from './path.port.ts';

export type PathModule = Pick<typeof pathModule, 'sep' | 'join' | 'tempDir' | 'documentDir' | 'desktopDir' | 'homeDir'>;
export type FsModule = {
  readFile(path: string): Promise<Uint8Array>;
  exists(path: string): Promise<boolean>;
  writeTextFile(path: string, contents: string): Promise<void>;
};

const loadFs = (): Promise<FsModule> => import('@tauri-apps/plugin-fs');

export type ConvertFileSrc = (filePath: string, protocol?: string) => string;

export function createTauriPathPort(
  mod: PathModule = pathModule,
  load: () => Promise<FsModule> = loadFs,
  convert: ConvertFileSrc = coreConvertFileSrc,
): PathPort {
  return {
    sep: () => mod.sep(),
    join: (...parts) => mod.join(...parts),
    tempDir: () => mod.tempDir(),
    documentDir: () => mod.documentDir(),
    desktopDir: () => mod.desktopDir(),
    homeDir: () => mod.homeDir(),
    readFile: async (path) => (await load()).readFile(path),
    exists: async (path) => (await load()).exists(path),
    writeTextFile: async (path, contents) => (await load()).writeTextFile(path, contents),
    convertFileSrc: (filePath, protocol) => convert(filePath, protocol),
  };
}
