import { StateEffect, type EditorState, type Transaction } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

export interface SlashCommandsConfig {
  /** Reactive on/off. Returning false disables the trigger entirely. */
  enabled: () => boolean;
  /**
   * Per-id label overrides. Optional — falls back to the block's
   * built-in English label.
   */
  labelFor?: (id: string) => string | undefined;
  /** Per-id hint overrides. */
  hintFor?: (id: string) => string | undefined;
  /** Localized "no results" template — `{query}` is replaced. */
  emptyHint?: (query: string) => string;
}

export interface SlashState {
  /** Position of the leading `/` character. */
  triggerPos: number;
  /** End of the typed query (cursor position). */
  end: number;
  /** Substring after `/`, lower-cased filter source. */
  query: string;
  /** Currently highlighted entry in the filtered list. */
  selectedIndex: number;
}

export const setSlashState = StateEffect.define<SlashState | null>();

export function nextSlashState(value: SlashState | null, tr: Transaction): SlashState | null {
  // Explicit set-effects win.
  for (const e of tr.effects) {
    if (e.is(setSlashState)) {
      value = e.value;
    }
  }
  if (!value) return null;

  // If the doc changed, walk the change set and remap our trigger /
  // end positions. A change that removes the leading `/` cancels.
  if (tr.docChanged) {
    const triggerPos = tr.changes.mapPos(value.triggerPos, -1);
    if (triggerPos >= tr.state.doc.length) return null;
    const ch = tr.state.doc.sliceString(triggerPos, triggerPos + 1);
    if (ch !== '/') return null;
    // Cursor must still be on the same line as the trigger.
    const triggerLine = tr.state.doc.lineAt(triggerPos);
    const sel = tr.state.selection.main.head;
    if (sel < triggerPos || sel > triggerLine.to) return null;
    const newQuery = tr.state.doc.sliceString(triggerPos + 1, sel);
    // Cancel on whitespace / newlines / common terminators in the query.
    if (/[\s,;\n]/.test(newQuery)) return null;
    value = { ...value, end: sel, query: newQuery, selectedIndex: 0 };
    return value;
  }

  // No doc change — selection may still have moved (Esc / arrow).
  if (tr.selection) {
    const sel = tr.state.selection.main.head;
    if (sel < value.triggerPos) return null;
    const triggerLine = tr.state.doc.lineAt(value.triggerPos);
    if (sel > triggerLine.to) return null;
    // Cursor moved past the typed query end — accept it as the new end.
    const newEnd = Math.max(value.triggerPos + 1, sel);
    const newQuery = tr.state.doc.sliceString(value.triggerPos + 1, newEnd);
    if (/[\s,;\n]/.test(newQuery)) return null;
    value = { ...value, end: newEnd, query: newQuery };
  }
  return value;
}

export function isTriggerPosition(state: EditorState, pos: number): boolean {
  if (pos <= 0) return true;
  const line = state.doc.lineAt(pos);
  if (pos === line.from) return true;
  const prevCh = state.doc.sliceString(pos - 1, pos);
  return /\s/.test(prevCh);
}

export function isInsideCodeContext(state: EditorState, pos: number): boolean {
  // Use the syntax tree so we get correct results inside fenced code,
  // inline code, and code blocks. `resolveInner` finds the deepest node
  // covering `pos`.
  const node = syntaxTree(state).resolveInner(pos, -1);
  for (let n: typeof node | null = node; n; n = n.parent) {
    const name = n.name;
    if (
      name === 'FencedCode' ||
      name === 'CodeBlock' ||
      name === 'InlineCode' ||
      name === 'CodeMark' ||
      name === 'CodeText' ||
      name === 'CodeInfo'
    ) {
      return true;
    }
  }
  return false;
}
