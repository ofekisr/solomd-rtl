import type { NodeObj } from 'mind-elixir';

export type SortOrder = 'asc' | 'desc';

const MIN_SORTABLE = 2;
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareTopics(a: NodeObj, b: NodeObj): number {
  return collator.compare(a.topic.trim(), b.topic.trim());
}

function isAscending(children: readonly NodeObj[]): boolean {
  return children.every((child, i) => i === 0 || compareTopics(children[i - 1], child) <= 0);
}

export function sortChildrenByTopic(node: NodeObj): SortOrder | null {
  const children = node.children;
  if (!children || children.length < MIN_SORTABLE) return null;
  const order: SortOrder = isAscending(children) ? 'desc' : 'asc';
  children.sort(order === 'asc' ? compareTopics : (a, b) => compareTopics(b, a));
  return order;
}
