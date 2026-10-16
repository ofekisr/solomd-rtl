/**
 * Folder-wide replace. Files on disk are rewritten by the Rust
 * `replace_in_dir` command; files open in a tab are rewritten in their buffer
 * instead (via `replace_in_text`), so unsaved edits survive and ⌘Z works.
 * Every run is planned first (dry run + buffer pass) so the caller can show
 * exact counts before anything is written.
 */
import { invoke } from '@tauri-apps/api/core';
import { inFolder, useTabsStore } from '../stores/tabs';
import type { SearchOptions } from './useGlobalSearch';

const FLUSH_CONTENT_EVENT = 'solomd:flush-content-sync';

export interface ReplaceInput {
  root: string;
  query: string;
  replacement: string;
  options: SearchOptions;
  /** Limit to these files (per-file replace); omit for the whole folder. */
  only?: string[];
}

interface DiskSummary {
  filesChanged: number;
  replacements: number;
  errors: string[];
}

interface BufferEdit {
  tabId: string;
  text: string;
  count: number;
}

export interface ReplacePlan {
  input: ReplaceInput;
  openFiles: string[];
  buffers: BufferEdit[];
  disk: DiskSummary;
}

export interface ReplaceResult {
  files: number;
  replacements: number;
  errors: string[];
}

function combine(disk: DiskSummary, buffers: BufferEdit[]): { files: number; replacements: number } {
  return {
    files: disk.filesChanged + buffers.length,
    replacements: disk.replacements + buffers.reduce((n, b) => n + b.count, 0),
  };
}

export function planTotals(plan: ReplacePlan): { files: number; replacements: number } {
  return combine(plan.disk, plan.buffers);
}

export function useFolderReplace() {
  const tabs = useTabsStore();

  function openTabsInScope(input: ReplaceInput) {
    return tabs.tabs.filter((t) => {
      if (!t.filePath || !inFolder(t.filePath, input.root)) return false;
      return !input.only || input.only.includes(t.filePath);
    });
  }

  function runOnDisk(input: ReplaceInput, exclude: string[], dryRun: boolean) {
    return invoke<DiskSummary>('replace_in_dir', {
      request: { ...input, only: input.only ?? null, exclude, dryRun },
    });
  }

  async function planBuffer(input: ReplaceInput, tabId: string, text: string, filePath: string): Promise<BufferEdit> {
    const res = await invoke<{ text: string; count: number }>('replace_in_text', {
      text,
      filePath,
      query: input.query,
      replacement: input.replacement,
      options: input.options,
    });
    return { tabId, text: res.text, count: res.count };
  }

  async function plan(input: ReplaceInput): Promise<ReplacePlan> {
    window.dispatchEvent(new Event(FLUSH_CONTENT_EVENT));
    const open = openTabsInScope(input);
    const openFiles = open.map((t) => t.filePath!);
    const edits = await Promise.all(open.map((t) => planBuffer(input, t.id, t.content, t.filePath!)));
    const disk = await runOnDisk(input, openFiles, true);
    return { input, openFiles, buffers: edits.filter((e) => e.count > 0), disk };
  }

  async function apply(p: ReplacePlan): Promise<ReplaceResult> {
    const disk = await runOnDisk(p.input, p.openFiles, false);
    for (const edit of p.buffers) tabs.setContent(edit.tabId, edit.text);
    return { ...combine(disk, p.buffers), errors: disk.errors };
  }

  return { plan, apply };
}
