import { invoke } from '@tauri-apps/api/core';
import { parseTheme, type Theme } from './schema.ts';

type JsonFile = { id: string; json: string };
const bundled = import.meta.glob<Theme>(['./builtin/*.json', './catalog/*.json'], { eager: true, import: 'default' });

export function bundledThemes(): Theme[] {
  return Object.values(bundled);
}

function parseFile(file: JsonFile): { theme?: Theme; error?: string } {
  try {
    const r = parseTheme(JSON.parse(file.json));
    return r.ok ? { theme: { ...r.theme, source: 'mine' } } : { error: `${file.id}.json — ${r.error}` };
  } catch (e) {
    return { error: `${file.id}.json — ${String(e)}` };
  }
}

async function listFiles(): Promise<JsonFile[]> {
  const files = await invoke<JsonFile[] | null>('theme_json_list').catch(() => null);
  return Array.isArray(files) ? files : [];
}

export async function loadMyThemes(): Promise<{ themes: Theme[]; errors: string[] }> {
  const parsed = (await listFiles()).map(parseFile);
  return {
    themes: parsed.flatMap((p) => (p.theme ? [p.theme] : [])),
    errors: parsed.flatMap((p) => (p.error ? [p.error] : [])),
  };
}

export async function saveMyTheme(theme: Theme): Promise<void> {
  await invoke('theme_json_save', { id: theme.id, json: JSON.stringify(theme, null, 2) });
}

export async function removeMyTheme(id: string): Promise<void> {
  await invoke('theme_json_remove', { id });
}
