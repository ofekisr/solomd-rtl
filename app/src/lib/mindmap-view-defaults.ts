import type { NodeObj } from 'mind-elixir';

export function hasAnyNote(node: NodeObj): boolean {
  if ((node.note ?? '').trim() !== '') return true;
  return (node.children ?? []).some(hasAnyNote);
}
