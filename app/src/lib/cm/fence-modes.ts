/**
 * Per-block view mode for rendered fences (mermaid, Graphviz) in live edit:
 *
 *   edit    — source only, never rendered
 *   split   — source with the rendered diagram beside it (wide editor) or
 *             below it (narrow editor)
 *   preview — rendered, even while the caret is inside the block
 *
 * A block with no mode picked keeps the default reveal model: rendered,
 * source while the caret is in it. Modes are keyed by the position of the
 * block's opening line and mapped through edits; they live in editor state
 * only, never in the document.
 */
import { StateEffect, StateField, type Text } from '@codemirror/state';
import { EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import { isGraphvizLang } from '../graphviz.ts';

export type FenceViewMode = 'edit' | 'split' | 'preview';
export type DiagramKind = 'mermaid' | 'graphviz';

const MODES: readonly { mode: FenceViewMode; label: string }[] = [
  { mode: 'edit', label: 'Edit' },
  { mode: 'split', label: 'Split' },
  { mode: 'preview', label: 'Preview' },
];

/** Editor width (px) from which a split block puts the diagram on the right. */
const SPLIT_SIDE_MIN_WIDTH = 900;

const FENCE_OPEN = /^\s*```/;

export function diagramFenceKind(text: string): DiagramKind | null {
  const lang = /^\s*```\s*([\w-]+)\s*$/.exec(text)?.[1]?.toLowerCase();
  if (lang === 'mermaid') return 'mermaid';
  return lang && isGraphvizLang(lang) ? 'graphviz' : null;
}

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

export const setFenceMode = StateEffect.define<{ from: number; mode: FenceViewMode }>();

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

export const setSplitSide = StateEffect.define<boolean>();

/** Whether the editor is wide enough for split blocks to go side by side. */
export const splitSideField = StateField.define<boolean>({
  create: () => false,
  update(isSide, tr) {
    for (const effect of tr.effects) if (effect.is(setSplitSide)) return effect.value;
    return isSide;
  },
});

const splitSideWatcher = ViewPlugin.fromClass(
  class {
    private readonly view: EditorView;

    constructor(view: EditorView) {
      this.view = view;
      this.check();
    }

    update(): void {
      this.check();
    }

    private check(): void {
      this.view.requestMeasure({
        key: this,
        read: (view) => view.contentDOM.clientWidth >= SPLIT_SIDE_MIN_WIDTH,
        write: (isWide, view) => {
          if (isWide === view.state.field(splitSideField, false)) return;
          queueMicrotask(() => view.dispatch({ effects: setSplitSide.of(isWide) }));
        },
      });
    }
  },
);

export function fenceModeToolbar(view: EditorView, from: number, active: FenceViewMode): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'cm-md-code-mode-toggle';
  bar.setAttribute('contenteditable', 'false');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Block view');
  for (const { mode, label } of MODES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.title = label;
    btn.className = `cm-md-code-mode-btn cm-md-code-mode-${mode}`;
    if (mode === active) btn.classList.add('cm-md-code-mode-active');
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

/**
 * Side-by-side split. The diagram is laid out absolutely in the right half
 * of the block (below its opening line), so the source lines keep their own
 * measured heights; a spacer after the closing line grows when the diagram
 * is taller than the source, so nothing below overlaps it.
 */
function syncSplitSpacer(view: EditorView, key: number): void {
  view.requestMeasure({
    read: () => {
      const pane = view.dom.querySelector<HTMLElement>(`[data-split-pane="${key}"]`);
      const spacer = view.dom.querySelector<HTMLElement>(`[data-split-spacer="${key}"]`);
      if (!pane || !spacer) return null;
      const overflow = pane.getBoundingClientRect().bottom - spacer.getBoundingClientRect().top;
      return { spacer, height: `${Math.max(0, Math.ceil(overflow))}px` };
    },
    write: (measured) => {
      if (!measured || measured.spacer.style.height === measured.height) return;
      measured.spacer.style.height = measured.height;
      view.requestMeasure();
    },
  });
}

export class SplitPaneWidget extends WidgetType {
  private readonly inner: WidgetType;
  private readonly from: number;
  private observer: ResizeObserver | null = null;

  constructor(inner: WidgetType, from: number) {
    super();
    this.inner = inner;
    this.from = from;
  }

  eq(other: SplitPaneWidget): boolean {
    return other.inner.constructor === this.inner.constructor && other.inner.eq(this.inner) && other.from === this.from;
  }

  toDOM(view: EditorView): HTMLElement {
    const pane = document.createElement('div');
    pane.className = 'cm-fence-split-pane';
    pane.dataset.splitPane = String(this.from);
    pane.appendChild(this.inner.toDOM(view));
    this.observer = new ResizeObserver(() => syncSplitSpacer(view, this.from));
    this.observer.observe(pane);
    return pane;
  }

  destroy(): void {
    this.observer?.disconnect();
  }

  ignoreEvent(): boolean {
    return true;
  }
}

export class SplitSpacerWidget extends WidgetType {
  private readonly from: number;

  constructor(from: number) {
    super();
    this.from = from;
  }

  eq(other: SplitSpacerWidget): boolean {
    return other.from === this.from;
  }

  toDOM(view: EditorView): HTMLElement {
    const spacer = document.createElement('div');
    spacer.className = 'cm-fence-split-spacer';
    spacer.dataset.splitSpacer = String(this.from);
    syncSplitSpacer(view, this.from);
    return spacer;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const fenceModesTheme = EditorView.theme({
  '.cm-fence-has-modes': { position: 'relative' },
  '.cm-fence-has-modes .cm-md-code-mode-toggle': { top: '6px', right: '8px' },
  '.cm-fence-split-side': { paddingRight: 'calc(50% + 12px) !important' },
  '.cm-fence-split-pane': {
    position: 'absolute',
    zIndex: '2',
    top: '100%',
    right: '0',
    width: '50%',
    boxSizing: 'border-box',
    padding: '8px',
    borderLeft: '1px solid var(--md-code-border, var(--border))',
    cursor: 'default',
    fontFamily: 'var(--font-ui)',
  },
  '.cm-fence-split-pane .cm-live-block': { padding: '0' },
  // The spacer carries on the block's box so the diagram stays inside it.
  '.cm-fence-split-side.cm-md-fenced-last': {
    borderBottom: 'none !important',
    borderBottomLeftRadius: '0 !important',
    borderBottomRightRadius: '0 !important',
  },
  '.cm-fence-split-spacer': {
    boxSizing: 'content-box',
    background: 'var(--md-code-bg)',
    border: '1px solid var(--md-code-border, var(--border))',
    borderTop: 'none',
    borderRadius: '0 0 6px 6px',
  },
});

export const fenceModesExtension = [fenceModeField, splitSideField, splitSideWatcher, fenceModesTheme];
