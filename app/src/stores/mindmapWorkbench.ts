import { defineStore } from 'pinia';
import type { MindElixirData } from 'mind-elixir';
import { entryKey, parseWorkbench, removeEntries, sanitizeSnapshot, upsertEntry, type EntryDraft, type WorkbenchEntry } from '../lib/mindmap/workbench.ts';

const LS_KEY = 'solomd.mindmapWorkbench.v1';
const ID_PREFIX = 'wb-';

function storage(): Storage | null {
  return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
}

function load(): WorkbenchEntry[] {
  try {
    return parseWorkbench(JSON.parse(storage()?.getItem(LS_KEY) ?? '[]'));
  } catch {
    return [];
  }
}

export const useMindmapWorkbenchStore = defineStore('mindmapWorkbench', {
  state: () => ({ entries: load() }),
  getters: {
    selectedEntries: (s): WorkbenchEntry[] => s.entries.filter((e) => e.selected),
  },
  actions: {
    persist(): void {
      try {
        storage()?.setItem(LS_KEY, JSON.stringify(this.entries));
      } catch (err) {
        console.error('mindmap workbench persist failed', err);
      }
    },
    add(draft: EntryDraft): 'added' | 'updated' {
      const res = upsertEntry(this.entries, draft, `${ID_PREFIX}${crypto.randomUUID()}`);
      this.entries = res.entries;
      this.persist();
      return res.status;
    },
    has(key: string): boolean { return this.entries.some((e) => entryKey(e) === key); },
    removeKey(key: string): void {
      this.entries = this.entries.filter((e) => entryKey(e) !== key);
      this.persist();
    },
    removeSelected(): void {
      this.entries = removeEntries(this.entries, new Set(this.selectedEntries.map((e) => e.id)));
      this.persist();
    },
    toggle(id: string): void {
      this.entries = this.entries.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e));
      this.persist();
    },
    setAll(selected: boolean): void {
      this.entries = this.entries.map((e) => ({ ...e, selected }));
      this.persist();
    },
    replaceSnapshot(id: string, snapshot: MindElixirData): void {
      const capturedAt = new Date().toISOString();
      this.entries = this.entries.map((e) => (e.id === id && e.kind === 'nodes' ? { ...e, snapshot: sanitizeSnapshot(snapshot), capturedAt } : e));
      this.persist();
    },
  },
});
