import type { NodeObj } from 'mind-elixir';
import type { Summary } from 'mind-elixir/dist/types/summary';

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

export interface SummaryRemap {
  kept: Summary[];
  droppedCount: number;
}

function newRange(summary: Summary, before: readonly NodeObj[], after: readonly NodeObj[]): [number, number] | null {
  const covered = before.slice(summary.start, summary.end + 1);
  const indices = covered.map((node) => after.indexOf(node));
  const start = Math.min(...indices);
  const end = Math.max(...indices);
  const isContiguous = !indices.includes(-1) && end - start + 1 === covered.length;
  return isContiguous ? [start, end] : null;
}

export function remapSummaries(
  summaries: readonly Summary[],
  parentId: string,
  before: readonly NodeObj[],
  after: readonly NodeObj[],
): SummaryRemap {
  const kept: Summary[] = [];
  let droppedCount = 0;
  for (const summary of summaries) {
    const range = summary.parent === parentId ? newRange(summary, before, after) : [summary.start, summary.end];
    if (!range) droppedCount += 1;
    else kept.push({ ...summary, start: range[0], end: range[1] });
  }
  return { kept, droppedCount };
}
