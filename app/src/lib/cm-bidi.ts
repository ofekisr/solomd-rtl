import { StateField, type Extension, type Range } from '@codemirror/state';
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { documentDirection, type TextDirection } from './doc-direction';

// Hebrew / Arabic: the whole document takes one direction (see
// documentDirection), so English lines in a Hebrew note align right as well.
// Fenced code lines are pinned LTR; indented blocks follow the document.
// `perLineTextDirection` makes CodeMirror honour
// that per-line override for caret motion and selection drawing.
function directionField(forcedDirection?: TextDirection): StateField<TextDirection> {
  return StateField.define<TextDirection>({
    create: (state) => forcedDirection ?? documentDirection(state.doc.toString()),
    update: (dir, tr) => forcedDirection
      ?? (tr.docChanged ? documentDirection(tr.newDoc.toString()) : dir),
  });
}

const CODE_NODE_NAMES = new Set(['FencedCode']);
const ltrLine = Decoration.line({ attributes: { dir: 'ltr' } });

function buildCodeLineDecorations(view: EditorView): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const { doc } = view.state;
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (!CODE_NODE_NAMES.has(node.name)) return;
        const last = doc.lineAt(Math.min(node.to, to)).number;
        for (let n = doc.lineAt(Math.max(node.from, from)).number; n <= last; n++) {
          ranges.push(ltrLine.range(doc.line(n).from));
        }
        return false;
      },
    });
  }
  return Decoration.set(ranges, true);
}

const codeLinesLtr = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildCodeLineDecorations(view);
    }
    update(update: ViewUpdate): void {
      const treeChanged = syntaxTree(update.startState) !== syntaxTree(update.state);
      if (update.docChanged || update.viewportChanged || treeChanged) {
        this.decorations = buildCodeLineDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

export function bidiExtension(forcedDirection?: TextDirection): Extension {
  const docDirection = directionField(forcedDirection);
  return [
    docDirection,
    // Keep the root direction for CodeMirror's flex layout (gutter placement).
    EditorView.editorAttributes.compute([docDirection], (state) => ({
      dir: state.field(docDirection),
    })),
    // Text direction belongs on the content so bidi cursor movement follows it.
    EditorView.contentAttributes.compute([docDirection], (state) => ({
      dir: state.field(docDirection),
    })),
    EditorView.perLineTextDirection.of(true),
    codeLinesLtr,
    EditorView.theme({
      '.cm-line': { textAlign: 'start' },
      '&[dir="rtl"] .cm-gutters-before': {
        insetInlineStart: 'auto',
        insetInlineEnd: '0',
      },
    }),
  ];
}
