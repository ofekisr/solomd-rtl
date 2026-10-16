import { readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { MMAP_EXTENSION, parseMindmap, rootTopicFromFileName, serializeMindmap } from '../../app/src/lib/mindmap-format.ts';
import type { MapDisplay } from '../../app/src/lib/mindmap-display.ts';
import type { Snippet } from '../../app/src/lib/mindmap-snippets.ts';
import { resolveNode } from '../../app/src/lib/mindmap-address.ts';
import type { ServerConfig } from './config.ts';

export interface MapDoc { data: MindElixirData; display: MapDisplay; snippets: Snippet[] }

const TMP_SUFFIX = '.mcp-tmp';
const MAX_SCAN_DEPTH = 6;

export class MapStore {
  private readonly cfg: ServerConfig;
  private readonly root: string;

  constructor(cfg: ServerConfig) {
    this.cfg = cfg;
    this.root = resolve(cfg.workspace);
  }

  resolve(file: string): string {
    const abs = resolve(this.root, file);
    const rel = relative(this.root, abs);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`"${file}" must be inside the workspace ${this.root}`);
    if (!abs.endsWith(`.${MMAP_EXTENSION}`)) throw new Error(`"${file}" is not a .${MMAP_EXTENSION} file`);
    return abs;
  }

  async load(file: string): Promise<MapDoc> {
    const abs = this.resolve(file);
    const parsed = parseMindmap(await readFile(abs, 'utf8'), rootTopicFromFileName(abs));
    if (!parsed.ok) throw new Error(`${file}: ${parsed.error}`);
    return { data: parsed.data, display: parsed.display, snippets: parsed.snippets };
  }

  async save(file: string, doc: MapDoc): Promise<void> {
    this.assertWritable();
    const abs = this.resolve(file);
    await writeFile(abs + TMP_SUFFIX, serializeMindmap(doc.data, doc.display, doc.snippets));
    await rename(abs + TMP_SUFFIX, abs);
  }

  assertWritable(): void {
    if (!this.cfg.allowWrite) throw new Error('Read-only: restart the server with --allow-write to edit maps');
  }

  async list(dir: string = this.root, depth = 0): Promise<string[]> {
    if (depth > MAX_SCAN_DEPTH) return [];
    const entries = await readdir(dir, { withFileTypes: true });
    const subdirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith('.'));
    const nested = await Promise.all(subdirs.map((e) => this.list(join(dir, e.name), depth + 1)));
    const here = entries.filter((e) => e.isFile() && e.name.endsWith(`.${MMAP_EXTENSION}`)).map((e) => relative(this.root, join(dir, e.name)));
    return [...here, ...nested.flat()];
  }
}

export function requireNode(doc: MapDoc, ref: string): NodeObj {
  const res = resolveNode(doc.data.nodeData, ref);
  if (!res.ok) throw new Error(res.error);
  return res.node;
}
