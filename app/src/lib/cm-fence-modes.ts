/**
 * Per-block view mode for rendered fences (mermaid, Graphviz) in live edit:
 *
 *   edit    — source only, never rendered
 *   split   — source, with the rendered diagram below it
 *   preview — rendered, even while the caret is inside the block
 *
 * A block with no mode picked keeps the default reveal model: rendered,
 * source while the caret is in it. Modes are keyed by the position of the
 * block's opening line and mapped through edits; they live in editor state
 * only, never in the document.
 */
import { StateEffect, StateField, type Text } from '@codemirror/state';
import { EditorView, WidgetType } from '@codemirror/view';

export type FenceViewMode = 'edit' | 'split' | 'preview';

const MODES: readonly { mode: FenceViewMode; label: string }[] = [
  { mode: 'edit', label: 'Edit' },
  { mode: 'split', label: 'Split' },
  { mode: 'preview', label: 'Preview' },
];

const FENCE_OPEN = /^\s*```/;

/**
 * Where a block's opening line went after an edit. A whole-document replace
 * (another pane on the same tab syncing in) maps every position to an end
 * of the doc, so fall back to the same line number when the mapped spot is
 * not a fence opening.
 */
function remapFenceStart(before: Text, after: Text, mapped: number, from: number): number {
  const line = after.lineAt(mapped);
  if (line.from === mapped && FENCE_OPEN.test(line.text)) return mapped;
  const lineNo = Math.min(before.lineAt(from).number, after.lines);
  return after.line(lineNo).from;
}

export const setFenceMode =StateEffect.define<{ from: number; mode: FenceViewMode }>();

export const fenceModeField = StateField.define<ReadonlyMap<number, FenceViewMode>>({
  create: () => new Map(),
  update(modes, tr) {
    let next = modes;
    if (tr.docChanged && modes.size) {
      const mapped = new Map<number, FenceViewMode>();
      for (const [from, mode] of modes) {
        mapped.set(remapFenceStart(tr.startState.doc, tr.state.doc, tr.changes.mapPos(from), from), mode);
      }
      next = mapped;
    }
    for (const effect of tr.effects) {
      if (!effect.is(setFenceMode)) continue;
      if (next === modes) next = new Map(modes);
      (next as Map<number, FenceViewMode>).set(effect.value.from, effect.value.mode);
    }
    return next;
  },
});

export function fenceModeToolbar(view: EditorView, from: number, active: FenceViewMode): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'cm-fence-modes';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Block view');
  for (const { mode, label } of MODES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.className = mode === active ? 'cm-fence-mode cm-fence-mode--active' : 'cm-fence-mode';
    btn.setAttribute('aria-pressed', String(mode === active));
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({ effects: setFenceMode.of({ from, mode }) });
    });
    bar.appendChild(btn);
  }
  return bar;
}

/** The toolbar on a fence whose source is showing (rides its opening line). */
export class FenceModeWidget extends WidgetType {
  private readonly from: number;
  private readonly active: FenceViewMode;

  constructor(from: number, active: FenceViewMode) {
    super();
    this.from = from;
    this.active = active;
  }

  eq(other: FenceModeWidget): boolean {
    return other.from === this.from && other.active === this.active;
  }

  toDOM(view: EditorView): HTMLElement {
    return fenceModeToolbar(view, this.from, this.active);
  }

  ignoreEvent(): boolean {
    return true;
  }
}

/** A rendered diagram with the toolbar laid over its top-right corner. */
export class ModedDiagramWidget extends WidgetType {
  private readonly inner: WidgetType;
  private readonly from: number;
  private readonly active: FenceViewMode;

  constructor(inner: WidgetType, from: number, active: FenceViewMode) {
    super();
    this.inner = inner;
    this.from = from;
    this.active = active;
  }

  eq(other: ModedDiagramWidget): boolean {
    return (
      other.inner.constructor === this.inner.constructor &&
      other.inner.eq(this.inner) &&
      other.from === this.from &&
      other.active === this.active
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const el = this.inner.toDOM(view);
    el.classList.add('cm-fence-has-modes');
    el.appendChild(fenceModeToolbar(view, this.from, this.active));
    return el;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export const fenceModesTheme = EditorView.theme({
  '.cm-fence-has-modes': { position: 'relative' },
  '.cm-fence-modes': {
    position: 'absolute',
    zIndex: '3',
    top: '1px',
    right: '60px',
    display: 'inline-flex',
    height: '20px',
    border: '1px solid var(--border)',
    borderRadius: '5px',
    overflow: 'hidden',
    background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
    font: '11px/18px var(--font-ui)',
    opacity: '0.7',
    userSelect: 'none',
    transition: 'opacity 0.15s',
  },
  '.cm-fence-has-modes .cm-fence-modes': { top: '6px', right: '8px' },
  '.cm-fence-modes:hover': { opacity: '1' },
  '.cm-fence-mode': {
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    padding: '0 8px',
    font: 'inherit',
    cursor: 'pointer',
  },
  '.cm-fence-mode + .cm-fence-mode': { borderLeft: '1px solid var(--border)' },
  '.cm-fence-mode:hover': { color: 'var(--accent)' },
  '.cm-fence-mode--active': {
    color: 'var(--accent)',
    background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
  },
});
