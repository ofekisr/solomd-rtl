/**
 * Heading folding in the rendered preview. A folded heading hides the sibling
 * blocks after it up to the next heading of the same or a shallower level —
 * the same section rule the editors use (heading-fold.ts), applied to DOM.
 */

export const FOLD_TOGGLE_CLASS = 'preview-fold-toggle';
export const FOLDED_HEADING_CLASS = 'preview-heading--folded';
export const HIDDEN_BLOCK_CLASS = 'preview-fold-hidden';
const HEADING_TAG_RE = /^H([1-6])$/;

export interface FoldBlock {
  /** Heading level 1–6, or null for any other block. */
  level: number | null;
  /** Fold key for headings; ignored for other blocks. */
  key?: string;
}

/** Which blocks are hidden, given the folded heading keys. */
export function hiddenBlocks(blocks: readonly FoldBlock[], folded: ReadonlySet<string>): boolean[] {
  let hideUntilLevel: number | null = null;
  return blocks.map((block) => {
    if (block.level !== null && hideUntilLevel !== null && block.level <= hideUntilLevel) {
      hideUntilLevel = null;
    }
    const isHidden = hideUntilLevel !== null;
    if (!isHidden && block.level !== null && block.key && folded.has(block.key)) {
      hideUntilLevel = block.level;
    }
    return isHidden;
  });
}

/** Stable per-document keys: heading text plus an occurrence counter. */
export function headingKeys(titles: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return titles.map((title) => {
    const n = seen.get(title) ?? 0;
    seen.set(title, n + 1);
    return `${title}#${n}`;
  });
}

function headingLevel(el: Element): number | null {
  const m = HEADING_TAG_RE.exec(el.tagName);
  return m ? Number(m[1]) : null;
}

function headingTitle(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll(`.${FOLD_TOGGLE_CLASS}`).forEach((n) => n.remove());
  return (clone.textContent ?? '').trim();
}

export interface PreviewFoldOptions {
  folded: Set<string>;
  label: string;
  onChange?: () => void;
}

/** Adds a toggle to every top-level heading that has content under it and
 *  applies the current fold state. Safe to call again after each render. */
export function attachPreviewFolds(root: HTMLElement, opts: PreviewFoldOptions): void {
  const children = Array.from(root.children);
  const levels = children.map(headingLevel);
  const headingIndexes = levels.flatMap((level, i) => (level === null ? [] : [i]));
  const keys = headingKeys(headingIndexes.map((i) => headingTitle(children[i])));
  const keyAt = new Map(headingIndexes.map((childIndex, n) => [childIndex, keys[n]]));

  const apply = (): void => {
    const blocks = children.map((_, i) => ({ level: levels[i], key: keyAt.get(i) }));
    hiddenBlocks(blocks, opts.folded).forEach((isHidden, i) => {
      children[i].classList.toggle(HIDDEN_BLOCK_CLASS, isHidden);
      const key = keyAt.get(i);
      if (key) children[i].classList.toggle(FOLDED_HEADING_CLASS, opts.folded.has(key));
    });
  };

  headingIndexes.forEach((childIndex) => {
    const heading = children[childIndex] as HTMLElement;
    const key = keyAt.get(childIndex)!;
    const next = children[childIndex + 1];
    const nextLevel = next ? headingLevel(next) : 0;
    const hasBody = !!next && (nextLevel === null || nextLevel > levels[childIndex]!);
    heading.querySelector(`:scope > .${FOLD_TOGGLE_CLASS}`)?.remove();
    if (!hasBody) return;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = FOLD_TOGGLE_CLASS;
    toggle.contentEditable = 'false';
    toggle.setAttribute('aria-label', opts.label);
    toggle.title = opts.label;
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (opts.folded.has(key)) opts.folded.delete(key);
      else opts.folded.add(key);
      apply();
      opts.onChange?.();
    });
    heading.prepend(toggle);
  });
  apply();
}
