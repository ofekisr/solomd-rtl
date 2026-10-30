import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { combosFor, toCodeMirrorKey } from '../../../lib/keybindings.ts';
import type { SettingsStore } from '../../editor/contracts/index.ts';

export const UNBOUND_CM_KEY = 'F24';

/** The user's chord for AI rewrite, in CodeMirror's spelling. */
export function currentAiRewriteKey(keybindings: SettingsStore['keybindings']): string {
  const combos = combosFor('editor.aiRewrite', keybindings);
  // Unbound: a key no chord produces, so the extension stays inert rather
  // than falling back to ⌘J behind the user's back.
  return combos.length ? toCodeMirrorKey(combos[0]) : UNBOUND_CM_KEY;
}

export function aiLockExtension(isLocked: boolean): Extension {
  return isLocked ? [EditorState.readOnly.of(true), EditorView.editable.of(false)] : [];
}
