import { settingsPort } from '../../platform/index.ts';
import { parseTheme, serializeTheme, type Theme } from './schema.ts';

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
  const files = await settingsPort.themeJsonList().catch(() => null);
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
  await settingsPort.themeJsonSave({ id: theme.id, json: serializeTheme(theme) });
}

export async function removeMyTheme(id: string): Promise<void> {
  await settingsPort.themeJsonRemove({ id });
}
