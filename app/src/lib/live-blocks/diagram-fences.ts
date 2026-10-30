import { RangeSetBuilder, type Text } from '@codemirror/state';
import { Decoration } from '@codemirror/view';
import { ModedDiagramWidget, SplitPaneWidget, SplitSpacerWidget, type DiagramKind, type FenceViewMode } from '../cm-fence-modes.ts';
import { isLineWithin } from './layout.ts';
import { diagramWidget } from './diagram-widgets.ts';
import { type BlockOptions } from './options.ts';

export interface DiagramFenceContext {
  doc: Text;
  cursorLine: number;
  cursorLineEnd: number;
  keepSource: boolean;
  opts: BlockOptions;
  modes: ReadonlyMap<number, FenceViewMode>;
  isSplitSide: boolean;
}

export function addDiagramFence(
  builder: RangeSetBuilder<Decoration>,
  kind: DiagramKind,
  openLine: number,
  closeLine: number,
  ctx: DiagramFenceContext,
): void {
  const open = ctx.doc.line(openLine);
  const close = ctx.doc.line(closeLine);
  const mode = ctx.modes.get(open.from);
  const isCaretInside = ctx.keepSource
    || isLineWithin(ctx.cursorLine, openLine, closeLine)
    || isLineWithin(ctx.cursorLineEnd, openLine, closeLine);
  const isRendered = mode === 'preview' || (!mode && !isCaretInside);
  const body = ctx.doc.sliceString(ctx.doc.line(openLine + 1).from, close.from).replace(/\n$/, '');
  const theme = ctx.opts.getMermaidTheme?.() ?? 'default';
  if (isRendered) {
    builder.add(open.from, close.to, Decoration.replace({
      widget: new ModedDiagramWidget(diagramWidget(kind, body, theme), open.from, 'preview'),
      block: true,
    }));
    return;
  }
  if (mode !== 'split') return;
  const diagram = diagramWidget(kind, body, theme);
  if (!ctx.isSplitSide) {
    builder.add(close.to, close.to, Decoration.widget({ widget: diagram, block: true, side: 1 }));
    return;
  }
  builder.add(open.to, open.to, Decoration.widget({ widget: new SplitPaneWidget(diagram, open.from), side: 1 }));
  for (let ln = openLine + 1; ln <= closeLine; ln++) {
    const from = ctx.doc.line(ln).from;
    builder.add(from, from, splitSideLine);
  }
  builder.add(close.to, close.to, Decoration.widget({ widget: new SplitSpacerWidget(open.from), block: true, side: 1 }));
}

export const splitSideLine = Decoration.line({ class: 'cm-fence-split-side' });
