import { EditorView } from '@codemirror/view';
import { getSearchQuery, setSearchQuery } from '@codemirror/search';

// Incremental find. CoreMirror's search panel only scrolls to a match when you
// press Enter / click Next — typing in the field just repaints the highlights
// in place. On a long document the nearest match stays off-screen, so it looks
// like find "found nothing" even though it did (reported: "the search box that Ctrl+F opens
// does not jump to where the text is"). Browsers, VS Code and Typora all scroll to the first
// match as you type; this restores that. We only scroll the match into view —
// the editor selection is left untouched so we never fight the caret or an
// in-progress IME composition, and pressing Enter afterwards still walks matches
// from the current position exactly as before.
export function firstMatch(query: ReturnType<typeof getSearchQuery>, view: EditorView, from: number) {
  // Nearest match at/after the cursor; wrap to the top if there's none below.
  const forward = query.getCursor(view.state, from).next();
  if (!forward.done) return forward.value;
  const wrapped = query.getCursor(view.state, 0, from).next();
  return wrapped.done ? null : wrapped.value;
}

export const incrementalFindScroll = EditorView.updateListener.of((update) => {
  if (!update.transactions.some((tr) => tr.effects.some((e) => e.is(setSearchQuery)))) return;
  const query = getSearchQuery(update.state);
  if (!query.valid || !query.search) return;
  const view = update.view;
  const match = firstMatch(query, view, view.state.selection.main.from);
  if (!match) return;
  // Dispatching synchronously from an updateListener is unsupported; defer a
  // frame and re-check the query hasn't changed under us in the meantime.
  requestAnimationFrame(() => {
    if (!getSearchQuery(view.state).eq(query)) return;
    view.dispatch({ effects: EditorView.scrollIntoView(match.from, { y: 'center' }) });
  });
});
