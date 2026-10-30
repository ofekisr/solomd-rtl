import type { ViewLike } from '../../editor/contracts/index.ts';

export const CURSOR_MARKER = '$|$';

export function insertMarkdownInView(view: ViewLike, snippet: string): void {
  const cursorIdx = snippet.indexOf(CURSOR_MARKER);
  const finalText = cursorIdx >= 0 ? snippet.replace(CURSOR_MARKER, '') : snippet;
  const sel = view.state.selection.main;
  const needsLeadingBreak = snippet.startsWith('\n') && sel.from > 0 &&
    view.state.doc.sliceString(sel.from - 1, sel.from) !== '\n';
  const insertText = needsLeadingBreak ? '\n' + finalText : finalText;
  const adjust = needsLeadingBreak ? 1 : 0;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: insertText },
    selection: {
      anchor: cursorIdx >= 0 ? sel.from + cursorIdx + adjust : sel.from + insertText.length,
    },
  });
  view.focus();
}
