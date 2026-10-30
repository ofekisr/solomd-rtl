import type { DocAccess, ViewLike } from '../../editor/contracts/index.ts';
import { applyFormat, FORMAT_KINDS, type FormatKind } from '../../../lib/md-format.ts';
import { type CaseMode, caseTargetRange, nextCaseInCycle, transformCase } from '../../../lib/text-case.ts';

export { FORMAT_KINDS };
export type { CaseMode, FormatKind };

export function transformCaseInView(view: ViewLike, mode: CaseMode | 'cycle'): void {
  const sel = view.state.selection.main;
  const target = caseTargetRange(view.state.doc.toString(), sel.from, sel.to);
  if (!target) return;
  const next = mode === 'cycle' ? nextCaseInCycle(target.text) : mode;
  const replaced = transformCase(target.text, next);
  if (replaced === target.text) return;
  view.dispatch({
    changes: { from: target.from, to: target.to, insert: replaced },
    selection: { anchor: target.from, head: target.from + replaced.length },
  });
  view.focus();
}

export function formatMarkdownInView(view: ViewLike, kind: FormatKind): void {
  const sel = view.state.selection.main;
  const edit = applyFormat(view.state.doc.toString(), sel.from, sel.to, kind);
  view.dispatch({
    changes: { from: edit.from, to: edit.to, insert: edit.insert },
    selection: { anchor: edit.selFrom, head: edit.selTo },
    scrollIntoView: true,
    userEvent: 'input.format',
  });
  view.focus();
}

export function cmDocAccess(getView: () => ViewLike | null): DocAccess {
  return {
    getDoc: () => getView()?.state.doc.toString() ?? '',
    getCaret: () => getView()?.state.selection.main.head ?? 0,
    replaceRange: (from, to, text) => {
      getView()?.dispatch({ changes: { from, to, insert: text } });
    },
  };
}
