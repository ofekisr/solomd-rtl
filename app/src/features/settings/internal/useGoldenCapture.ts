import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createPinia, setActivePinia } from 'pinia';
import { withLocalStorage } from './local-storage-stub.ts';
import { SETTINGS_STORAGE_KEY } from '../contracts/settings-slice.port.ts';

export const NONE_CASE = 'none';
export const BLOBS_DIR = fileURLToPath(new URL('./__fixtures__/blobs/', import.meta.url));
export const EXPECTED_DIR = fileURLToPath(new URL('./__fixtures__/expected/', import.meta.url));

export function listBlobNames(): string[] {
  return readdirSync(BLOBS_DIR).filter((file) => file.endsWith('.json')).map((file) => file.slice(0, -'.json'.length)).sort();
}

export function readBlob(name: string): string {
  return readFileSync(`${BLOBS_DIR}${name}.json`, 'utf8');
}

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value === null || typeof value !== 'object') return value;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return Object.fromEntries(entries.map(([key, item]) => [key, sortKeysDeep(item)]));
}

export interface StoreCapture {
  state: Record<string, unknown>;
  hadStored: boolean;
}

export async function captureStoreState(blob: string | null): Promise<StoreCapture> {
  const stub = withLocalStorage(blob === null ? {} : { [SETTINGS_STORAGE_KEY]: blob });
  try {
    const { useSettingsStore, hadStoredSettings } = await import('../../../stores/settings.ts');
    setActivePinia(createPinia());
    const state = JSON.parse(JSON.stringify(useSettingsStore().$state)) as Record<string, unknown>;
    return { state: sortKeysDeep(state) as Record<string, unknown>, hadStored: hadStoredSettings() };
  } finally {
    stub.restore();
  }
}
