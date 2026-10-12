import type { MindElixirData, NodeObj } from 'mind-elixir';
import { documentDirection } from './doc-direction.ts';

export const MINDMAP_LAYOUT = { LEFT: 0, RIGHT: 1, SIDE: 2, DOWN: 3 } as const;
type MindmapLayout = (typeof MINDMAP_LAYOUT)[keyof typeof MINDMAP_LAYOUT];

function collectTopics(node: NodeObj, out: string[]): string[] {
  out.push(node.topic);
  for (const child of node.children ?? []) collectTopics(child, out);
  return out;
}

export function layoutDirectionFor(data: MindElixirData): MindmapLayout {
  if (data.direction !== undefined) return data.direction;
  const text = collectTopics(data.nodeData, []).join('\n');
  return documentDirection(text) === 'rtl' ? MINDMAP_LAYOUT.LEFT : MINDMAP_LAYOUT.SIDE;
}
