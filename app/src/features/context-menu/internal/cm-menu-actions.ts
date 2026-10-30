import type { ViewLike } from '../../editor/contracts/index.ts';
import type { EditorMenuAction } from '../../../components/EditorContextMenu.vue';

export interface MenuClipboard {
  read(): Promise<string>;
  write(text: string): Promise<void>;
}

export function cmSelectionText(view: ViewLike | null): string {
  const sel = view?.state.selection.main;
  return view && sel && !sel.empty ? view.state.sliceDoc(sel.from, sel.to) : '';
}

export async function runCmMenuAction(
  view: ViewLike,
  id: Exclude<EditorMenuAction, 'translate'>,
  clipboard: MenuClipboard,
): Promise<void> {
  const sel = view.state.selection.main;
  if (id === 'selectAll') {
    view.dispatch({ selection: { anchor: 0, head: view.state.doc.length }, userEvent: 'select' });
  } else if (id === 'copy' || id === 'cut') {
    if (sel.empty) return;
    await clipboard.write(view.state.sliceDoc(sel.from, sel.to));
    if (id === 'cut') {
      view.dispatch({ changes: { from: sel.from, to: sel.to, insert: '' }, userEvent: 'delete.cut' });
    }
  } else if (id === 'paste') {
    const text = await clipboard.read();
    if (text) view.dispatch({ ...view.state.replaceSelection(text), userEvent: 'input.paste', scrollIntoView: true });
  }
  view.focus();
}
