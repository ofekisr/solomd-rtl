import { readdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { MMAP_EXTENSION, parseMindmap, rootTopicFromFileName, serializeMindmap } from '../../../../app/src/lib/mindmap/format.ts';
import type { MapDisplay } from '../../../../app/src/lib/mindmap/display.ts';
import type { Snippet } from '../../../../app/src/lib/mindmap/snippets.ts';
import { resolveNode } from '../../../../app/src/lib/mindmap/address.ts';
import { withGateLabels } from '../../../../app/src/lib/mindmap/gates.ts';
import type { ServerConfig } from './config.ts';
import { AiActivity, NO_ACTIVITY, type ActivityMarker } from './ai-activity.ts';

export interface MapDoc { data: MindElixirData; display: MapDisplay; snippets: Snippet[] }

const TMP_SUFFIX = '.mcp-tmp';
const BROKEN_GATE_LABEL = '⚠ missing target';
const NOT_FOUND = 'ENOENT';
const PARENT = '..';
let tmpCounter = 0;

function isOutside(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === PARENT || rel.startsWith(PARENT + sep) || isAbsolute(rel);
}

function errorCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException).code;
}
const MAX_SCAN_DEPTH = 6;

export class MapStore {
  private readonly cfg: ServerConfig;
  private readonly root: string;
  private realRootPromise?: Promise<string>;
  private readonly activity: ActivityMarker;

  constructor(cfg: ServerConfig, activity: ActivityMarker = cfg.allowWrite ? new AiActivity() : NO_ACTIVITY) {
    this.cfg = cfg;
    this.root = resolve(cfg.workspace);
    this.activity = activity;
  }

  resolve(file: string): string {
    const abs = resolve(this.root, file);
    if (isOutside(this.root, abs)) throw this.outside(file);
    if (!abs.endsWith(`.${MMAP_EXTENSION}`)) throw new Error(`"${file}" is not a .${MMAP_EXTENSION} file`);
    return abs;
  }

  private outside(file: string): Error {
    return new Error(`"${file}" must be inside the workspace ${this.root}`);
  }

  private async realRoot(): Promise<string> {
    this.realRootPromise ??= realpath(this.root);
    return this.realRootPromise;
  }

  async resolveReal(file: string): Promise<string> {
    const abs = this.resolve(file);
    const root = await this.realRoot();
    try {
      if (isOutside(root, await realpath(abs))) throw this.outside(file);
    } catch (error) {
      if (errorCode(error) !== NOT_FOUND) throw error;
      if (isOutside(root, await realpath(dirname(abs)))) throw this.outside(file);
    }
    return abs;
  }

  private async readMap(file: string, abs: string): Promise<string> {
    try {
      return await readFile(abs, 'utf8');
    } catch (error) {
      if (errorCode(error) === NOT_FOUND) throw new Error(`Map not found: ${file}`);
      throw error;
    }
  }

  async load(file: string): Promise<MapDoc> {
    const abs = await this.resolveReal(file);
    await this.activity.touch(abs);
    return this.parse(file, abs);
  }

  async peek(file: string): Promise<MapDoc> {
    return this.parse(file, await this.resolveReal(file));
  }

  private async parse(file: string, abs: string): Promise<MapDoc> {
    const parsed = parseMindmap(await this.readMap(file, abs), rootTopicFromFileName(abs));
    if (!parsed.ok) throw new Error(`${file}: ${parsed.error}`);
    return { data: parsed.data, display: parsed.display, snippets: parsed.snippets };
  }

  async save(file: string, doc: MapDoc): Promise<void> {
    this.assertWritable();
    const abs = await this.resolveReal(file);
    await this.activity.touch(abs);
    const tmp = `${abs}.${process.pid}.${tmpCounter++}${TMP_SUFFIX}`;
    try {
      await writeFile(tmp, serializeMindmap(withGateLabels(doc.data, BROKEN_GATE_LABEL), doc.display, doc.snippets), { flag: 'wx' });
      await rename(tmp, abs);
    } catch (error) {
      await unlink(tmp).catch(() => undefined);
      throw error;
    }
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
