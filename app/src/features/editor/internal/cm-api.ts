import { EditorView } from '@codemirror/view';
import type { LineSelection } from '../contracts/editor-api.port.ts';
import type { ViewLike } from '../contracts/editor-feature.port.ts';

const GOTO_Y_MARGIN_PX = 40;
const SCROLL_Y_MARGIN_PX = 8;
const MAX_LINE_FRACTION = 0.999;
const MIN_FRACTION_TO_INTERPOLATE = 0.001;

function clampLine(view: EditorView, line: number): number {
  return Math.max(1, Math.min(Math.floor(line), view.state.doc.lines));
}

export function cmGotoLine(view: EditorView, line: number): void {
  const safe = Math.max(1, Math.min(line, view.state.doc.lines));
  const lineObj = view.state.doc.line(safe);
  view.dispatch({
    selection: { anchor: lineObj.from },
    effects: EditorView.scrollIntoView(lineObj.from, { y: 'start', yMargin: GOTO_Y_MARGIN_PX }),
  });
  view.focus();
}

export function cmGetLineSelection(view: ViewLike): LineSelection {
  const { doc, selection } = view.state;
  const main = selection.main;
  const toLine = doc.lineAt(main.to);
  const endsAtLineStart = !main.empty && main.to === toLine.from && toLine.number > 1;
  return {
    fromLine: doc.lineAt(main.from).number,
    toLine: endsAtLineStart ? toLine.number - 1 : toLine.number,
    headLine: doc.lineAt(main.head).number,
    isEmpty: main.empty,
  };
}

export function cmGetViewLine(view: EditorView): number {
  const top = view.scrollDOM.scrollTop;
  const block = view.lineBlockAtHeight(top);
  const frac = block.height > 0 ? Math.max(0, Math.min(MAX_LINE_FRACTION, (top - block.top) / block.height)) : 0;
  return view.state.doc.lineAt(block.from).number + frac;
}

/** Top of the 1-indexed line in scrollTop coordinates; the split-pane sync interpolates between two of these. */
export function cmLineTopY(view: EditorView, line: number): number {
  const safe = clampLine(view, line);
  return view.lineBlockAt(view.state.doc.line(safe).from).top;
}

/** Scroll the line to the viewport top without moving the cursor. Fractional lines (12.5) interpolate inside tall wrapped lines. */
export function cmScrollToLine(view: EditorView, line: number): void {
  const safe = clampLine(view, line);
  const frac = Math.max(0, Math.min(line - safe, MAX_LINE_FRACTION));
  const lineObj = view.state.doc.line(safe);
  if (frac > MIN_FRACTION_TO_INTERPOLATE) {
    const block = view.lineBlockAt(lineObj.from);
    const y = view.documentTop + block.top + frac * block.height;
    const scroller = view.scrollDOM.getBoundingClientRect();
    view.scrollDOM.scrollTop += y - scroller.top - SCROLL_Y_MARGIN_PX;
    return;
  }
  view.dispatch({ effects: EditorView.scrollIntoView(lineObj.from, { y: 'start', yMargin: SCROLL_Y_MARGIN_PX }) });
}
