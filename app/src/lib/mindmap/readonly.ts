import type { MindElixirInstance } from 'mind-elixir';
import { layoutDirectionFor } from './direction.ts';
import { parseMindmapFence } from './fence.ts';
import { withGateLabels } from './gates.ts';

export const MINDMAP_BLOCK_HEIGHT_PX = 360;

export interface ReadOnlyMindmap { setDark(isDark: boolean): void; destroy(): void }
export type ReadOnlyMountResult = { ok: true; map: ReadOnlyMindmap } | { ok: false; error: string };

type MindElixirModule = typeof import('mind-elixir');

function themeOf(module: MindElixirModule, isDark: boolean) {
  return isDark ? module.default.DARK_THEME : module.default.THEME;
}

function fitOnceLaidOut(el: HTMLElement, mind: MindElixirInstance): ResizeObserver {
  const observer = new ResizeObserver((entries) => {
    const box = entries[0]?.contentRect;
    if (!box || box.width === 0 || box.height === 0) return;
    observer.disconnect();
    mind.scaleFit();
    mind.toCenter();
  });
  observer.observe(el);
  return observer;
}

function wrap(mind: MindElixirInstance, module: MindElixirModule, observer: ResizeObserver): ReadOnlyMindmap {
  return {
    setDark: (isDark) => mind.changeTheme(themeOf(module, isDark)),
    destroy: () => { observer.disconnect(); mind.destroy(); },
  };
}

export async function mountReadOnlyMindmap(el: HTMLElement, body: string, isDark: boolean, brokenLabel: string): Promise<ReadOnlyMountResult> {
  const parsed = parseMindmapFence(body);
  if (!parsed.ok) return parsed;
  const [module] = await Promise.all([import('mind-elixir'), import('mind-elixir/style.css')]);
  el.style.height = `${MINDMAP_BLOCK_HEIGHT_PX}px`;
  const mind = new module.default({
    el, direction: layoutDirectionFor(parsed.data), editable: false, contextMenu: false,
    keypress: false, toolBar: true, theme: themeOf(module, isDark),
  });
  mind.init(withGateLabels(parsed.data, brokenLabel));
  return { ok: true, map: wrap(mind, module, fitOnceLaidOut(el, mind)) };
}
