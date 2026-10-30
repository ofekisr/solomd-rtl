export interface PathPort {
  sep(): string;
  join(...parts: string[]): Promise<string>;
  tempDir(): Promise<string>;
  documentDir(): Promise<string>;
  desktopDir(): Promise<string>;
  homeDir(): Promise<string>;
  readFile(path: string): Promise<Uint8Array>;
  exists(path: string): Promise<boolean>;
  writeTextFile(path: string, contents: string): Promise<void>;
}
