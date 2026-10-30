import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import type { Extension } from '@codemirror/state';
import {
  crosshairCursor,
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view';
import { dragAwareExtension } from '../../../../lib/cm-drag-aware.ts';
import { imeCompositionGuard } from '../../../../lib/cm-ime-guard.ts';
import { stableClickSelection } from '../../../../lib/cm-stable-click.ts';
import { taskListExtension } from '../../../../lib/cm-task-list.ts';
import type { EditorFeature } from '../../contracts/editor-feature.port.ts';

export const SOLID_CURSOR_BLINK_MS = 0;
export const DEFAULT_CURSOR_BLINK_MS = 1200;
const SELECT_PARENT_SYNTAX_KEY = 'Mod-i';

// #344 — caret-line tint. Selector is one step more specific than the base
// theme's transparent `.cm-activeLine` so it wins regardless of order.
export function activeLineExtension(on: boolean): Extension {
  if (!on) return [];
  return EditorView.theme({
    '.cm-content .cm-line.cm-activeLine': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 9%, transparent)',
    },
  });
}

// #296 — Mod-i is CodeMirror's selectParentSyntax. The app-level Italic
// shortcut listens on window, so CodeMirror would run first and widen the
// selection to the whole paragraph before it got italicised.
function coreKeymap(): Extension {
  return keymap.of([
    ...defaultKeymap.filter((b) => b.key !== SELECT_PARENT_SYNTAX_KEY),
    ...historyKeymap,
    ...searchKeymap,
    indentWithTab,
  ]);
}

// #90 — column/rectangular selection: hold Alt (Option on macOS) and drag to
// select a vertical block; `crosshairCursor` shows the mode is armed.
function selectionTools(): Extension {
  return [rectangularSelection(), crosshairCursor(), indentOnInput(), bracketMatching(), highlightActiveLine()];
}

export function createCoreFeature(): EditorFeature {
  return {
    id: 'core',
    settingsKeys: ['solidCursor', 'highlightCurrentLine', 'showLineNumbers', 'wordWrap'],
    i18nKeys: [],
    extensions: {
      'ime-guard': () => imeCompositionGuard(),
      history: () => history(),
      'drag-aware': () => dragAwareExtension(),
      'selection-tools': () => selectionTools(),
      keymap: () => coreKeymap(),
      'task-list': () => taskListExtension(),
      // #167 — clicks during async widget renders (post tab-switch) must not
      // turn into phantom multi-line selections when the layout shifts.
      'stable-click': () => stableClickSelection(),
    },
    slots: [
      {
        slot: 'cursor',
        deps: (ctx) => ctx.settings.solidCursor,
        // #193 — solid (non-blinking) caret option.
        build: (ctx) => drawSelection({ cursorBlinkRate: ctx.settings.solidCursor ? SOLID_CURSOR_BLINK_MS : DEFAULT_CURSOR_BLINK_MS }),
      },
      {
        slot: 'active-line',
        deps: (ctx) => ctx.settings.highlightCurrentLine,
        build: (ctx) => activeLineExtension(ctx.settings.highlightCurrentLine),
      },
      {
        slot: 'line-numbers',
        deps: (ctx) => ctx.settings.showLineNumbers,
        build: (ctx) => (ctx.settings.showLineNumbers ? lineNumbers() : []),
      },
      {
        slot: 'wrap',
        deps: (ctx) => ctx.settings.wordWrap,
        build: (ctx) => (ctx.settings.wordWrap ? EditorView.lineWrapping : []),
      },
    ],
  };
}
