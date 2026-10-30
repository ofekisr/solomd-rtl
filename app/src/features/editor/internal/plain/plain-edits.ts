import { computeListContinuation } from '../../../../lib/list-continuation.ts';

export type TextareaLike = Pick<HTMLTextAreaElement, 'value' | 'selectionStart' | 'selectionEnd'>;

/** Compute a Tab/Shift+Tab indent edit over the textarea's current selection. */
export function computePlainTabEdit(
  el: TextareaLike,
  outdent: boolean,
): { value: string; selStart: number; selEnd: number } {
  const INDENT = '  ';
  const v = el.value;
  const s = el.selectionStart ?? 0;
  const e = el.selectionEnd ?? 0;
  if (!outdent && s === e) {
    return { value: v.slice(0, s) + INDENT + v.slice(e), selStart: s + INDENT.length, selEnd: s + INDENT.length };
  }
  const lineStart = v.lastIndexOf('\n', s - 1) + 1;
  const nl = v.indexOf('\n', e);
  const lineEnd = nl < 0 ? v.length : nl;
  const region = v.slice(lineStart, lineEnd);
  const lines = region.split('\n');
  let deltaFirst = 0;
  let deltaTotal = 0;
  const newLines = lines.map((ln, i) => {
    if (outdent) {
      const m = ln.match(/^( {1,2}|\t)/);
      const removed = m ? m[0].length : 0;
      if (i === 0) deltaFirst = -removed;
      deltaTotal -= removed;
      return ln.slice(removed);
    }
    if (i === 0) deltaFirst = INDENT.length;
    deltaTotal += INDENT.length;
    return INDENT + ln;
  });
  const value = v.slice(0, lineStart) + newLines.join('\n') + v.slice(lineEnd);
  const selStart = Math.max(lineStart, s + deltaFirst);
  const selEnd = Math.max(selStart, e + deltaTotal);
  return { value, selStart, selEnd };
}


/**
 * Markdown list / quote continuation on Enter (#341) — same rule for both
 * plain editors, see lib/list-continuation.ts. Returns null to let the
 * textarea insert a plain newline.
 */
export function computeSmartEnter(el: TextareaLike): { value: string; caret: number } | null {
  return computeListContinuation(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0);
}

