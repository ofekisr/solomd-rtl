import type { MindElixirData } from 'mind-elixir';

export const MINDMAP_LAYOUT = { LEFT: 0, RIGHT: 1, SIDE: 2, DOWN: 3 } as const;
type MindmapLayout = (typeof MINDMAP_LAYOUT)[keyof typeof MINDMAP_LAYOUT];

export const DEFAULT_MINDMAP_LAYOUT: MindmapLayout = MINDMAP_LAYOUT.LEFT;

export function layoutDirectionFor(data: MindElixirData): MindmapLayout {
  return data.direction ?? DEFAULT_MINDMAP_LAYOUT;
}
