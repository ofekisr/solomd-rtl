/**
 * CodeMirror 6 block-level live-preview decorations for Markdown.
 *
 * Two block widgets, both gated on the cursor NOT being in the matched
 * block (move cursor in → source comes back):
 *
 *   1. **Image lines.** A line whose content is only `![alt](url)` (whitespace
 *      around it is fine, no other text) renders as an `<img>` element.
 *      Falls back to the source line if the image can't load.
 *
 *   2. **Tables.** A contiguous block of pipe-delimited lines with a
 *      separator row (the standard GFM table shape) renders as a real
 *      `<table>`. Tables don't need `extractImageRoot`, just markdown-it
 *      run on the source slice.
 *
 * This is the v3.6 implementation of issue #44 — "live edit should support
 * image / table live render". Companion to `cm-live-preview.ts` which
 * handles inline marker hiding.
 */

import { StateField, Prec, EditorSelection, Transaction, EditorState } from '@codemirror/state';
import { keymap, type DecorationSet, EditorView, ViewPlugin } from '@codemirror/view';
import { isDragging, isDragEndTransaction } from './cm-drag-aware.ts';
import { frozenFieldDuringComposition, isImeSafeFlushTransaction } from './cm-ime-guard.ts';
import { fenceModesExtension, setFenceMode, setSplitSide } from './cm-fence-modes.ts';
import { relayoutEffect } from './live-blocks/layout.ts';
import { TldrawWidget } from './live-blocks/tldraw-widget.ts';
import type { BlockOptions } from './live-blocks/options.ts';
import { buildBlockDecorations } from './live-blocks/decorations.ts';

/**
 * Live-render of standalone images / tables / block-math / Mermaid in the
 * WYSIWYG "live edit" mode. Returns a StateField (block decorations are not
 * allowed from view plugins) plus a companion view plugin that turns the
 * async-Mermaid `solomd:cm-relayout` window event into a field recompute.
 */
export function liveBlocksExtension(opts: BlockOptions = {}) {
  const field = StateField.define<DecorationSet>({
    create: (state) => buildBlockDecorations(state, opts),
    update(deco, tr) {
      // Rebuild on edits, on a relayout signal (Mermaid SVG ready), and on
      // the drag-end flush. Selection moves rebuild too (cursor entering a
      // block reveals its source), but not mid-drag — see cm-drag-aware.ts.
      const frozen = frozenFieldDuringComposition(tr, deco);
      if (frozen) return frozen;
      if (isImeSafeFlushTransaction(tr)) return buildBlockDecorations(tr.state, opts);
      if (tr.docChanged) return buildBlockDecorations(tr.state, opts);
      if (tr.effects.some((e) => e.is(relayoutEffect) || e.is(setFenceMode) || e.is(setSplitSide))) {
        return buildBlockDecorations(tr.state, opts);
      }
      if (isDragEndTransaction(tr)) return buildBlockDecorations(tr.state, opts);
      if (tr.selection && !isDragging(tr.state)) {
        return buildBlockDecorations(tr.state, opts);
      }
      return deco.map(tr.changes);
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  // Mermaid renders asynchronously; when its SVG cache fills, the widget
  // fires `solomd:cm-relayout`. Translate that into a `relayoutEffect` so the
  // field rebuilds and the widget remounts with the finished SVG.
  const relayout = ViewPlugin.fromClass(
    class {
      private readonly onRelayout: () => void;
      constructor(view: EditorView) {
        this.onRelayout = () => {
          view.dispatch({ effects: relayoutEffect.of(null) });
        };
        window.addEventListener('solomd:cm-relayout', this.onRelayout);
      }
      destroy() {
        window.removeEventListener('solomd:cm-relayout', this.onRelayout);
      }
    },
  );

  // #155 — ↑/↓ across a collapsed block widget. CM's default vertical motion
  // has no valid cursor position inside a replaced range, so from the line
  // next to a table/math/mermaid widget it hops clear over the block. Reveal
  // model says the caret should land ON the block's edge line instead, which
  // expands it to source. We compute the default target first and only step
  // in when that target would jump past a collapsed range.
  const arrowIntoBlock = (forward: boolean) => (view: EditorView) => {
    const sel = view.state.selection.main;
    if (!sel.empty || view.state.selection.ranges.length > 1) return false;
    const deco = view.state.field(field, false);
    if (!deco) return false;
    const doc = view.state.doc;
    const fromLine = doc.lineAt(sel.head);
    const def = view.moveVertically(sel, forward);
    const toLineNo = doc.lineAt(def.head).number;
    let handled = false;
    deco.between(0, doc.length, (from, to, d) => {
      if (!(d.spec as { block?: boolean }).block) return;
      // tldraw boards never reveal their source (no cursor-inside gating in
      // buildBlockDecorations), so parking the caret inside one just hides
      // it — let the default motion hop over the fence instead.
      if ((d.spec as { widget?: unknown }).widget instanceof TldrawWidget) return;
      const a = doc.lineAt(from).number;
      const b = doc.lineAt(to).number;
      const jumpedOver = forward
        ? fromLine.number < a && toLineNo > b
        : fromLine.number > b && toLineNo < a;
      if (!jumpedOver) return;
      const edge = doc.line(forward ? a : b);
      const col = Math.min(sel.head - fromLine.from, edge.length);
      view.dispatch({
        selection: { anchor: edge.from + col },
        scrollIntoView: true,
        userEvent: 'select',
      });
      handled = true;
      return false;
    });
    return handled;
  };
  const blockArrowKeymap = Prec.high(
    keymap.of([
      { key: 'ArrowUp', run: arrowIntoBlock(false) },
      { key: 'ArrowDown', run: arrowIntoBlock(true) },
    ]),
  );

  // #155 (vim) — the arrow keymap above never sees vim's `j`/`k`, which run
  // through @replit/codemirror-vim's own key handling, so vim motions still
  // hopped clear over collapsed blocks. Instead of chasing vim's dispatch
  // path, catch the *signature* of that hop at the transaction level: an
  // empty-cursor selection moving in one step from the line directly above a
  // collapsed block to the line directly below it (or the reverse). Only a
  // single-line vertical motion produces that pair, so counted jumps (`5j`),
  // searches and `G` stay untouched; pointer selections are excluded
  // explicitly. Retarget to the block's edge line — same reveal model as the
  // arrow fix.
  const vimBlockHop = EditorState.transactionFilter.of((tr) => {
    if (tr.docChanged || !tr.selection) return tr;
    const userEvent = tr.annotation(Transaction.userEvent);
    if (userEvent && userEvent.includes('pointer')) return tr;
    const prev = tr.startState.selection.main;
    const next = tr.newSelection.main;
    if (!prev.empty || !next.empty || tr.newSelection.ranges.length > 1) return tr;
    const doc = tr.startState.doc;
    const fromNo = doc.lineAt(prev.head).number;
    const toNo = doc.lineAt(next.head).number;
    if (Math.abs(toNo - fromNo) < 2) return tr;
    const deco = tr.startState.field(field, false);
    if (!deco) return tr;
    let retarget: number | null = null;
    deco.between(0, doc.length, (from, to, d) => {
      if (!(d.spec as { block?: boolean }).block) return;
      if ((d.spec as { widget?: unknown }).widget instanceof TldrawWidget) return;
      const a = doc.lineAt(from).number;
      const b = doc.lineAt(to).number;
      const forwardHop = fromNo === a - 1 && toNo === b + 1;
      const backwardHop = fromNo === b + 1 && toNo === a - 1;
      if (!forwardHop && !backwardHop) return;
      const edge = doc.line(forwardHop ? a : b);
      const col = Math.min(prev.head - doc.lineAt(prev.head).from, edge.length);
      retarget = edge.from + col;
      return false;
    });
    if (retarget === null) return tr;
    return [tr, { selection: EditorSelection.cursor(retarget), scrollIntoView: true, sequential: true }];
  });

  return [fenceModesExtension, field, relayout, blockArrowKeymap, vimBlockHop];
}

export { liveBlocksTheme } from './live-blocks/theme.ts';
// Re-exported helpers in case the editor wants to wire up the imageRoot
// extractor from outside.
export { extractImageRoot } from './markdown';
