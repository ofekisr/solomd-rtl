import type { DocAccess } from '../../editor/contracts/index.ts';
import { collectLabels, findMathSpanAt } from '../../../lib/equations.ts';
import { openFormulaEditor } from './formula-editor-bus.ts';
import { findTableSpan } from '../../../lib/markdown-table.ts';
import { openTableEditor } from './table-editor-bus.ts';

export interface DocRange { from: number; to: number }

const NOT_IN_TABLE_KEY = 'tableEditor.notInTable';

function lineStartOffsets(lines: string[]): number[] {
  const starts: number[] = [];
  let off = 0;
  for (const line of lines) {
    starts.push(off);
    off += line.length + 1;
  }
  return starts;
}

function lineIndexAt(starts: number[], caret: number): number {
  let caretLine = 0;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= caret) caretLine = i;
    else break;
  }
  return caretLine;
}

export function tableRangeAt(source: string, caret: number): DocRange | null {
  const lines = source.split('\n');
  const starts = lineStartOffsets(lines);
  const span = findTableSpan(lines, lineIndexAt(starts, caret));
  if (!span) return null;
  return { from: starts[span.startLine], to: starts[span.endLine] + lines[span.endLine].length };
}

export function formatMath(source: string, from: number, to: number, latex: string, display: boolean): string {
  if (!display) return `$${latex}$`;
  const lineStart = source.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
  const lineEndIdx = source.indexOf('\n', to);
  const lineEnd = lineEndIdx < 0 ? source.length : lineEndIdx;
  const alone =
    source.slice(lineStart, from).trim() === '' && source.slice(to, lineEnd).trim() === '';
  return alone ? `$$\n${latex}\n$$` : `$$${latex}$$`;
}

export function openTableWith(doc: DocAccess, notify: { info(m: string): void }, t: (k: string) => string): void {
  const source = doc.getDoc();
  if (!source) {
    notify.info(t(NOT_IN_TABLE_KEY));
    return;
  }
  const range = tableRangeAt(source, doc.getCaret());
  if (!range) {
    notify.info(t(NOT_IN_TABLE_KEY));
    return;
  }
  openTableEditor({
    source: source.slice(range.from, range.to),
    apply: (markdown: string) => doc.replaceRange(range.from, range.to, markdown),
  });
}

export function openFormulaWith(doc: DocAccess): void {
  const source = doc.getDoc();
  const caret = doc.getCaret();
  const span = findMathSpanAt(source, caret);
  const from = span ? span.from : caret;
  const to = span ? span.to : caret;
  openFormulaEditor({
    latex: span?.body ?? '',
    display: span?.display ?? false,
    labels: collectLabels(source),
    apply: (latex: string, display: boolean) =>
      doc.replaceRange(from, to, formatMath(source, from, to, latex, display)),
  });
}
