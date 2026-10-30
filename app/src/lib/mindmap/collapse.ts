export interface CollapsibleNode {
  readonly id: string;
  expanded?: boolean;
  readonly children?: readonly CollapsibleNode[];
  readonly parent?: CollapsibleNode;
}

export interface ToggleStep {
  readonly id: string;
  readonly expanded: boolean;
}

function hasChildren(node: CollapsibleNode): boolean {
  return (node.children?.length ?? 0) > 0;
}

function isOpen(node: CollapsibleNode): boolean {
  return node.expanded !== false;
}

function depthOf(node: CollapsibleNode): number {
  let depth = 0;
  for (let at = node.parent; at; at = at.parent) depth += 1;
  return depth;
}

function hasAncestorIn(node: CollapsibleNode, set: ReadonlySet<CollapsibleNode>): boolean {
  for (let at = node.parent; at; at = at.parent) if (set.has(at)) return true;
  return false;
}

export function planSelectionToggle(nodes: readonly CollapsibleNode[], rootId: string): ToggleStep[] {
  const targets = nodes.filter((node) => node.id !== rootId && hasChildren(node));
  if (targets.length === 0) return [];
  const expanded = !targets.some(isOpen);
  const set = new Set(targets);
  const affected = expanded ? targets : targets.filter((node) => !hasAncestorIn(node, set));
  const ordered = [...affected].sort((a, b) => depthOf(a) - depthOf(b));
  return ordered.map((node) => ({ id: node.id, expanded }));
}

export function hasOpenBranch(root: CollapsibleNode): boolean {
  return (root.children ?? []).some((child) => hasChildren(child) && isOpen(child));
}

export function setDescendantsExpanded(root: CollapsibleNode, expanded: boolean): void {
  for (const child of root.children ?? []) {
    if (hasChildren(child)) child.expanded = expanded;
    setDescendantsExpanded(child, expanded);
  }
}
