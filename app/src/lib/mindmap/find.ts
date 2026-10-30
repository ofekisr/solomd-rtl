/**
 * Find / replace over a mind map's node text (`topic` and `note`), never its
 * JSON. Pure helpers are exported for tests; `MindmapFindTarget` drives the live
 * Mind Elixir instance for the find bar: it highlights matching nodes, walks
 * them (expanding collapsed ancestors), and patches text through `reshapeNode`
 * so edits land in undo history and the normal save path.
 */
import type { MindElixirInstance, NodeObj } from 'mind-elixir';
import { walkNodes } from './gates.ts';
import {
  compileFind,
  lineMatches,
  replaceLines,
  replacementFor,
  type FindCounter,
  type FindSpec,
  type FindTarget,
} from '../find-spec.ts';

const HIT_CLASS = 'me-find-hit';
const TEXT_FIELDS = ['topic', 'note'] as const;

export function nodeMatches(node: NodeObj, re: RegExp): boolean {
  return TEXT_FIELDS.some((f) => lineMatches(node[f] ?? '', re));
}

export function matchingIds(root: NodeObj, re: RegExp): string[] {
  return walkNodes(root).filter((n) => nodeMatches(n, re)).map((n) => n.id);
}

export function nodeTextPatch(
  node: NodeObj,
  re: RegExp,
  replacement: string,
): { patch: Partial<NodeObj>; count: number } | null {
  const patch: Partial<NodeObj> = {};
  let count = 0;
  for (const field of TEXT_FIELDS) {
    const value = node[field];
    if (!value) continue;
    const res = replaceLines(value, re, replacement);
    if (!res.count) continue;
    patch[field] = res.text;
    count += res.count;
  }
  return count ? { patch, count } : null;
}

function liveElement(mind: MindElixirInstance, id: string) {
  try {
    return mind.findEle(id) ?? null;
  } catch {
    return null;
  }
}

function expandAncestors(mind: MindElixirInstance, node: NodeObj): void {
  const chain: NodeObj[] = [];
  for (let p = node.parent; p; p = p.parent) chain.unshift(p);
  for (const ancestor of chain) {
    if (ancestor.expanded !== false) continue;
    const el = liveElement(mind, ancestor.id);
    if (el) mind.expandNode(el, true);
  }
}

/** Select and centre node `id`, expanding collapsed ancestors first. */
export function revealNode(mind: MindElixirInstance, id: string): boolean {
  const node = walkNodes(mind.nodeData).find((n) => n.id === id);
  if (!node) return false;
  expandAncestors(mind, node);
  const el = liveElement(mind, id);
  if (!el) return false;
  mind.selectNode(el);
  mind.scrollIntoView(el, true);
  return true;
}

export interface MindmapFindDeps {
  getMind(): MindElixirInstance | null;
  canEdit(): boolean;
  /** Called after nodes hidden under a collapsed parent were edited in place. */
  markChanged(): void;
  close(): void;
}

export class MindmapFindTarget implements FindTarget {
  readonly supportsNamedGroups = true;
  private spec: FindSpec | null = null;
  private readonly deps: MindmapFindDeps;

  constructor(deps: MindmapFindDeps) {
    this.deps = deps;
  }

  setSpec(spec: FindSpec): void {
    this.spec = spec;
    this.highlight();
  }

  isValid(spec: FindSpec): boolean {
    return compileFind(spec) !== null;
  }

  counter(spec: FindSpec): FindCounter {
    const ids = this.ids(spec);
    const current = this.selectedId();
    return { index: current ? ids.indexOf(current) + 1 : 0, total: ids.length };
  }

  next(): void { this.step(1); }
  prev(): void { this.step(-1); }

  replaceOne(): void {
    const mind = this.deps.getMind();
    const re = this.re();
    const id = this.selectedId();
    if (!mind || !re || !this.spec || !this.deps.canEdit()) return;
    const node = id ? this.nodeById(mind, id) : null;
    if (node && nodeMatches(node, re)) this.patch(mind, node, re);
    this.next();
  }

  replaceAll(): void {
    const mind = this.deps.getMind();
    const re = this.re();
    if (!mind || !re || !this.deps.canEdit()) return;
    let editedHidden = false;
    for (const node of walkNodes(mind.nodeData)) {
      if (nodeMatches(node, re)) editedHidden = !this.patch(mind, node, re) || editedHidden;
    }
    if (editedHidden) this.deps.markChanged();
    this.highlight();
  }

  close(): void {
    this.clearHighlight();
    this.deps.close();
  }

  /** Re-apply match highlighting after the canvas re-renders. */
  refresh(): void {
    this.highlight();
  }

  private re(): RegExp | null {
    return this.spec ? compileFind(this.spec) : null;
  }

  private ids(spec: FindSpec): string[] {
    const mind = this.deps.getMind();
    const re = compileFind(spec);
    return mind && re ? matchingIds(mind.nodeData, re) : [];
  }

  private selectedId(): string | null {
    return this.deps.getMind()?.currentNode?.nodeObj.id ?? null;
  }

  private nodeById(mind: MindElixirInstance, id: string): NodeObj | null {
    return walkNodes(mind.nodeData).find((n) => n.id === id) ?? null;
  }

  /** Returns false when the node had no live element and was edited in place. */
  private patch(mind: MindElixirInstance, node: NodeObj, re: RegExp): boolean {
    const result = nodeTextPatch(node, re, replacementFor(this.spec!));
    if (!result) return true;
    const el = liveElement(mind, node.id);
    if (el) {
      mind.reshapeNode(el, result.patch);
      return true;
    }
    Object.assign(node, result.patch);
    return false;
  }

  private step(direction: 1 | -1): void {
    const mind = this.deps.getMind();
    if (!mind || !this.spec) return;
    const ids = this.ids(this.spec);
    if (!ids.length) return;
    const at = ids.indexOf(this.selectedId() ?? '');
    const nextIndex = at < 0 ? (direction > 0 ? 0 : ids.length - 1) : (at + direction + ids.length) % ids.length;
    this.reveal(mind, ids[nextIndex]);
  }

  private reveal(mind: MindElixirInstance, id: string): void {
    if (revealNode(mind, id)) this.highlight();
  }

  private clearHighlight(): void {
    const container = this.deps.getMind()?.container;
    container?.querySelectorAll(`.${HIT_CLASS}`).forEach((el) => el.classList.remove(HIT_CLASS));
  }

  private highlight(): void {
    this.clearHighlight();
    const mind = this.deps.getMind();
    const re = this.re();
    if (!mind || !re) return;
    for (const id of matchingIds(mind.nodeData, re)) liveElement(mind, id)?.classList.add(HIT_CLASS);
  }
}
