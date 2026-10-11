import type { MindElixirInstance } from 'mind-elixir';
import { layoutDirectionFor } from './mindmap-direction.ts';
import { parseMindmapFence } from './mindmap-fence.ts';

export const MINDMAP_BLOCK_HEIGHT_PX = 360;

export interface ReadOnlyMindmap { setDark(isDark: boolean): void; destroy(): void }
export type ReadOnlyMountResult = { ok: true; map: ReadOnlyMindmap } | { ok: false; error: string };

type MindElixirModule = typeof import('mind-elixir');

function themeOf(module: MindElixirModule, isDark: boolean) {
  return isDark ? module.default.DARK_THEME : module.default.THEME;
}

function wrap(mind: MindElixirInstance, module: MindElixirModule): ReadOnlyMindmap {
  return {
    setDark: (isDark) => mind.changeTheme(themeOf(module, isDark)),
    destroy: () => mind.destroy(),
  };
}

export async function mountReadOnlyMindmap(el: HTMLElement, body: string, isDark: boolean): Promise<ReadOnlyMountResult> {
  const parsed = parseMindmapFence(body);
  if (!parsed.ok) return parsed;
  const [module] = await Promise.all([import('mind-elixir'), import('mind-elixir/style.css')]);
  el.style.height = `${MINDMAP_BLOCK_HEIGHT_PX}px`;
  const mind = new module.default({
    el, direction: layoutDirectionFor(parsed.data), editable: false, contextMenu: false,
    keypress: false, toolBar: true, theme: themeOf(module, isDark),
  });
  mind.init(parsed.data);
  mind.scaleFit();
  mind.toCenter();
  return { ok: true, map: wrap(mind, module) };
}
