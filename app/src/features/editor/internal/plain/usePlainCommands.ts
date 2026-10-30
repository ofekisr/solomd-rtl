import { imageTextFromPath } from '../../../../lib/cm-image-paste';
import { collectLabels, findMathSpanAt } from '../../../../lib/equations';
import { openFormulaEditor } from '../../../../lib/formula-editor-bus';
import { scanHeadings } from '../../../../lib/heading-fold';
import { findTableSpan } from '../../../../lib/markdown-table';
import { markdownImage } from '../../../../lib/md-image-url';
import { openTableEditor } from '../../../../lib/table-editor-bus';
import { useI18n } from '../../../../i18n';
import { useSettingsStore } from '../../../../stores/settings';
import { useToastsStore } from '../../../../stores/toasts';
import type { EditorApi, FoldAction, LineSelection } from '../../contracts/editor-api.port.ts';
import type { PlainApi } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

/** The plain engine's half of the `EditorApi` exposed by the editor component. */
export function usePlainCommands(deps: PlainDeps, api: PlainApi): EditorApi {
  const { props, imagePasteOpts } = deps;
  const {
    applyPlainContent, openPlainFind, plainActiveBlock, plainBlockEditors, plainBlocks, plainEditor,
    plainFoldedLines, plainFolds, plainInsertText, plainLineHeightPx, plainLineStartOffset,
    plainLineTops, plainLiveEnabled, plainPaddingTopPx, plainScrollToLine, plainSetCaret, plainText,
    recordPlainHistory, setPlainFold,
  } = api;
  const settings = useSettingsStore();
  const toasts = useToastsStore();
  const { t } = useI18n();

  function openFind(): void {
    openPlainFind();
  }

  function openTableAtCursor(): void {
    const source = plainText.value || '';
    if (!source) {
      toasts.info(t('tableEditor.notInTable'));
      return;
    }
    const lines = source.split('\n');
    const caret = plainCaretOffset();

    // Offset → line index, plus each line's start offset for the reverse trip.
    const starts: number[] = [];
    let off = 0;
    for (const line of lines) {
      starts.push(off);
      off += line.length + 1;
    }
    let caretLine = 0;
    for (let i = 0; i < starts.length; i++) {
      if (starts[i] <= caret) caretLine = i;
      else break;
    }

    const span = findTableSpan(lines, caretLine);
    if (!span) {
      toasts.info(t('tableEditor.notInTable'));
      return;
    }
    const from = starts[span.startLine];
    const to = starts[span.endLine] + lines[span.endLine].length;

    openTableEditor({
      source: source.slice(from, to),
      apply: (markdown: string) => replaceDocRange(from, to, markdown),
    });
  }

  function openFormulaAtCursor(): void {
    const source = plainText.value || '';
    const caret = plainCaretOffset();
    const span = findMathSpanAt(source, caret);
    const from = span ? span.from : caret;
    const to = span ? span.to : caret;

    openFormulaEditor({
      latex: span?.body ?? '',
      display: span?.display ?? false,
      labels: collectLabels(source),
      apply: (latex: string, display: boolean) =>
        replaceDocRange(from, to, formatMath(source, from, to, latex, display)),
    });
  }

  function formatMath(
    source: string,
    from: number,
    to: number,
    latex: string,
    display: boolean,
  ): string {
    if (!display) return `$${latex}$`;
    const lineStart = source.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
    const lineEndIdx = source.indexOf('\n', to);
    const lineEnd = lineEndIdx < 0 ? source.length : lineEndIdx;
    const alone =
      source.slice(lineStart, from).trim() === '' && source.slice(to, lineEnd).trim() === '';
    return alone ? `$$\n${latex}\n$$` : `$$${latex}$$`;
  }

  /** Caret offset in the plain editor, in whole-document coordinates. */
  function plainCaretOffset(): number {
    if (plainLiveEnabled.value) {
      const block = plainBlocks.value[plainActiveBlock.value];
      const el = plainBlockEditors.value[plainActiveBlock.value];
      return (block?.start ?? 0) + (el?.selectionStart ?? 0);
    }
    return plainEditor.value?.selectionStart ?? 0;
  }

  function replaceDocRange(from: number, to: number, text: string): void {
    const src = plainText.value || '';
    recordPlainHistory();
    applyPlainContent(src.slice(0, from) + text + src.slice(to), from + text.length);
  }

  /** The Windows source textarea is the one path that cannot fold — a
   *  <textarea> has no way to hide a line — so it says so. */
  function applyFold(action: FoldAction, level = 2): void {
    if (!settings.foldingEnabled) {
      toasts.info(t('fold.disabledHint'));
      return;
    }
    if (props.tab.language !== 'markdown' && action !== 'none') return;

    if (!plainLiveEnabled.value) {
      toasts.info(t('fold.plainSourceHint'));
      return;
    }
    const text = plainText.value || '';
    const spans = scanHeadings(text).filter((h) => h.foldable);
    if (action === 'none') {
      plainFolds.value = [];
      return;
    }
    if (action === 'all') {
      plainFolds.value = spans.map((h) => ({ line: h.line, title: h.title }));
      return;
    }
    if (action === 'level') {
      plainFolds.value = spans
        .filter((h) => h.level >= level)
        .map((h) => ({ line: h.line, title: h.title }));
      return;
    }
    const caret = plainBlocks.value[plainActiveBlock.value]?.start ?? 0;
    const enclosing = spans.filter((h) => caret >= h.start && caret <= h.end).pop();
    if (!enclosing) return;
    setPlainFold(enclosing, !plainFoldedLines.value.has(enclosing.line));
  }

  function gotoLine(line: number): void {
    if (plainLiveEnabled.value) {
      plainSetCaret(plainLineStartOffset(line));
      plainScrollToLine(line);
      return;
    }
    const el = plainEditor.value;
    if (!el) return;
    plainSetCaret(plainLineStartOffset(line));
    plainScrollToLine(line);
  }

  async function insertImageFromPath(srcPath: string): Promise<void> {
    // Was `plainInsertText(srcPath)`: a dropped image file landed as a bare
    // path instead of an image link.
    const text = await imageTextFromPath(srcPath, imagePasteOpts());
    if (text) plainInsertText(text);
  }

  function insertImageUrl(url: string, alt = ''): void {
    const clean = (url || '').trim();
    if (!clean) return;
    plainInsertText(markdownImage(clean, alt));
  }

  async function uploadLocalImages(): Promise<void> {
    // The CodeMirror document is the only one this walks; the plain engine has none.
  }

  function getLineSelection(): LineSelection | null {
    return null;
  }

  /** Returns the 1-indexed line currently at the top of the visible viewport. */
  function getViewLine(): number | null {
    if (plainLiveEnabled.value) {
      const block = plainBlocks.value[plainActiveBlock.value];
      if (!block) return 1;
      return plainText.value.slice(0, block.start).split('\n').length;
    }
    const el = plainEditor.value;
    if (!el) return null;
    const top = el.scrollTop;
    const tops = plainLineTops.value;
    if (tops) {
      // Largest line whose measured top is at/above the viewport top, plus
      // the fraction of that line already scrolled past — split-pane sync
      // interpolates on it so the panes stay level inside tall wrapped lines.
      const y = Math.max(0, top - plainPaddingTopPx(el));
      let lo = 0;
      let hi = tops.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (tops[mid] <= y) lo = mid;
        else hi = mid - 1;
      }
      const h = lo + 1 < tops.length ? tops[lo + 1] - tops[lo] : plainLineHeightPx();
      const frac = h > 0 ? Math.min(0.999, (y - tops[lo]) / h) : 0;
      return lo + 1 + Math.max(0, frac);
    }
    const line = Math.max(1, Math.floor(top / plainLineHeightPx()) + 1);
    return line;
  }

  function lineTopY(line: number): number | null {
    if (plainLiveEnabled.value) return null;
    const el = plainEditor.value;
    const tops = plainLineTops.value;
    if (!el || !tops) return null;
    const i = Math.max(0, Math.min(Math.floor(line) - 1, tops.length - 1));
    return plainPaddingTopPx(el) + tops[i];
  }

  function scrollToLine(line: number): void {
    plainScrollToLine(line);
  }

  function insertMarkdown(snippet: string): void {
    plainInsertText(snippet);
  }

  return {
    getLineSelection, gotoLine, insertImageFromPath, insertImageUrl, uploadLocalImages, getViewLine,
    scrollToLine, lineTopY, insertMarkdown, openFind, applyFold, openTableAtCursor, openFormulaAtCursor,
  };
}
