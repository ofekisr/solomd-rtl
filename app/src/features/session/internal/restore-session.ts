import type { EditorView } from '@codemirror/view';
import type { EditorFeatureContext } from '../../editor/contracts/index.ts';
import { readSession } from '../../../lib/cm/session-restore.ts';

export function maybeRestoreSession(ctx: EditorFeatureContext, view: Pick<EditorView, 'state' | 'dispatch'>): void {
  const saved = readSession(ctx.tab().id);
  if (!saved || saved === '' || ctx.tab().content !== '') return;
  if (view.state.doc.length === 0 && saved !== view.state.doc.toString()) {
    view.dispatch({ changes: { from: 0, to: 0, insert: saved } });
  }
}
