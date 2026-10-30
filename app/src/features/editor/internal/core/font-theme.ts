import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { buildEditorFontStack } from '../../../../stores/settings.ts';

export function fontSizeTheme(px: number, family: string): Extension {
  return EditorView.theme({
    '&': { fontSize: `${px}px`, height: '100%' },
    '.cm-scroller': { fontFamily: buildEditorFontStack(family), lineHeight: '1.6' },
    '.cm-content': { padding: '12px 16px' },
    '.cm-gutters': {
      backgroundColor: 'transparent',
      border: 'none',
      color: 'var(--text-faint)',
    },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--accent)' },
    '.cm-cursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
    // CodeMirror's measured cursor layer can report the same x-coordinate for
    // adjacent insertion points around trailing RTL spaces. Let the browser
    // draw the native caret in RTL content so each typed space advances it.
    '&[dir="rtl"] .cm-content': { caretColor: 'var(--accent) !important' },
    '&[dir="rtl"] .cm-cursor': {
      display: 'none',
    },
    '.cm-selectionBackground, ::selection': { backgroundColor: 'rgba(255,159,64,0.25) !important' },
    // v4.3.0 issue #67: distinct current-match highlight for the Cmd+F search
    // panel. CM6 marks the active result with `.cm-searchMatch-selected` —
    // by default it's the same translucent color as the other matches so the
    // user can't tell which one they're on. Brighten it to the accent color
    // and tint the others down so the current one pops.
    '.cm-searchMatch': { backgroundColor: 'rgba(255,159,64,0.22)', borderRadius: '2px' },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'var(--accent, #ff9f40)',
      color: 'var(--accent-fg, #fff)',
      outline: '1px solid var(--accent, #ff9f40)',
    },
  });
}
