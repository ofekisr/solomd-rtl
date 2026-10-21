import type { NodeObj } from 'mind-elixir';

export interface FoldedLabels { direct: string; all: string; both: string }

const MAX_SHOWN = 999;
const BOTH_SEPARATOR = ' · ';
const LABEL_ATTRS: Readonly<Record<keyof FoldedLabels, string>> = { direct: 'data-count-direct', all: 'data-count-all', both: 'data-count-both' };
const EXPANDER_SELECTOR = 'me-epd';
const TOPIC_SELECTOR = ':scope > me-tpc';

function descendantCount(node: NodeObj): number {
  return (node.children ?? []).reduce((sum, child) => sum + 1 + descendantCount(child), 0);
}

function capped(count: number): string {
  return count > MAX_SHOWN ? `${MAX_SHOWN}+` : String(count);
}

export function foldedCountLabels(node: NodeObj): FoldedLabels | null {
  if (node.expanded !== false || !node.children?.length) return null;
  const direct = capped(node.children.length);
  const all = capped(descendantCount(node));
  return { direct, all, both: direct === all ? direct : direct + BOTH_SEPARATOR + all };
}

type TopicElement = HTMLElement & { nodeObj?: NodeObj };

function writeLabels(expander: HTMLElement, labels: FoldedLabels | null): void {
  for (const key of Object.keys(LABEL_ATTRS) as (keyof FoldedLabels)[]) {
    if (labels) expander.setAttribute(LABEL_ATTRS[key], labels[key]);
    else expander.removeAttribute(LABEL_ATTRS[key]);
  }
}

export function decorateFoldedCounts(root: ParentNode): void {
  for (const expander of root.querySelectorAll<HTMLElement>(EXPANDER_SELECTOR)) {
    const topic = expander.parentElement?.querySelector<TopicElement>(TOPIC_SELECTOR);
    writeLabels(expander, topic?.nodeObj ? foldedCountLabels(topic.nodeObj) : null);
  }
}
