import type { NodeObj } from 'mind-elixir';

export type NumberingScope = 'children' | 'selves';

const NUMBER_PREFIX = /^\s*\d+[.)]\s+/;
const FIRST_NUMBER = 1;

export function stripNumber(topic: string): string {
  return topic.replace(NUMBER_PREFIX, '');
}

function siblingOrder(node: NodeObj): number {
  return node.parent?.children?.indexOf(node) ?? -1;
}

function groupSelvesByParent(selected: readonly NodeObj[]): NodeObj[][] {
  const groups = new Map<string, NodeObj[]>();
  for (const node of selected) {
    if (!node.parent) continue;
    groups.set(node.parent.id, [...(groups.get(node.parent.id) ?? []), node]);
  }
  return [...groups.values()].map((group) => group.sort((a, b) => siblingOrder(a) - siblingOrder(b)));
}

export function numberingGroups(selected: readonly NodeObj[], scope: NumberingScope): NodeObj[][] {
  if (scope === 'selves') return groupSelvesByParent(selected);
  return selected.map((node) => node.children ?? []).filter((kids) => kids.length > 0);
}

function retitle(node: NodeObj, topic: string, changed: NodeObj[]): void {
  if (node.topic === topic) return;
  node.topic = topic;
  changed.push(node);
}

export function applyNumbers(groups: readonly NodeObj[][], isNumbered: boolean, skip: (n: NodeObj) => boolean): NodeObj[] {
  const changed: NodeObj[] = [];
  for (const group of groups) {
    let next = FIRST_NUMBER;
    for (const node of group.filter((n) => !skip(n))) {
      const bare = stripNumber(node.topic);
      retitle(node, isNumbered ? `${next++}. ${bare}` : bare, changed);
    }
  }
  return changed;
}
