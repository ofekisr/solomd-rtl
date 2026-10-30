import { EditorView } from '@codemirror/view';

/**
 * Read the selected Markdown source from a CodeMirror editor.
 *
 * Used by all four Copy-as-* paths. We do NOT require `.cm-editor.cm-focused`:
 * the toolbar's direct Copy button uses `@click`, which fires AFTER the
 * editor loses focus on mousedown — by the time we run, the focused-class is
 * already gone and the selection would silently fall through to whole-doc.
 *
 * Instead: read the current window selection, then walk up to confirm it
 * lives inside *some* `.cm-editor`. That stays correct whether the trigger
 * was a keyboard shortcut (focus preserved), a dropdown menu item using
 * `@mousedown.prevent` (focus preserved), or a plain `@click` button (focus
 * lost — but the selection range survives).
 */
/**
 * Read the active editor selection straight from CodeMirror's `EditorView`
 * state — the source of truth. This is required for **rectangular / column
 * selections** (#90): those are *multiple* selection ranges, which Chromium /
 * WebView2's single-range `window.getSelection()` can't represent, so the old
 * DOM-based reader saw a collapsed/empty selection and callers fell back to
 * the *whole document* ("select a block, copy → got everything"). Reading the
 * ranges from CM state also survives the editor losing DOM focus when a
 * toolbar Copy button is clicked (CM keeps the selection in state).
 *
 * Ranges are joined with the document's own line break, matching CodeMirror's
 * native multi-selection copy.
 */
function cmSelectionText(): string | null {
  const editors = Array.from(document.querySelectorAll<HTMLElement>('.cm-editor'));
  if (!editors.length) return null;
  // Prefer the focused editor; fall back to any editor that holds a non-empty
  // selection (covers blur-on-toolbar-click and split panes / tiles).
  const focused = document.querySelector<HTMLElement>('.cm-editor.cm-focused');
  const ordered = focused ? [focused, ...editors.filter((e) => e !== focused)] : editors;
  for (const el of ordered) {
    const view = EditorView.findFromDOM(el);
    if (!view) continue;
    const parts: string[] = [];
    for (const r of view.state.selection.ranges) {
      if (r.empty) continue;
      parts.push(view.state.sliceDoc(r.from, r.to));
    }
    if (parts.length) {
      const text = parts.join(view.state.lineBreak);
      return text.trim() ? text : null;
    }
  }
  return null;
}

/** Nearest ancestor element carrying a source-line annotation, walking up. */
function elementWithSourceLine(node: Node | null): HTMLElement | null {
  let n: Node | null = node;
  while (n && n.nodeType === Node.TEXT_NODE) n = n.parentNode;
  let el = n as HTMLElement | null;
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    if (el.hasAttribute?.('data-source-line') || el.hasAttribute?.('data-line')) return el;
    el = el.parentElement;
  }
  return null;
}

function sourceLineOf(el: HTMLElement): number {
  return Number(el.getAttribute('data-source-line') || el.getAttribute('data-line') || 0);
}

/**
 * Map a selection inside the rendered **preview pane** back to the Markdown
 * source. The preview blocks are annotated with `data-source-line` (1-indexed)
 * by `renderMarkdown`, so we slice `content` from the first selected block to
 * the end of the last selected block (block-granular — selecting part of a
 * paragraph copies the whole paragraph's source, which is the sensible
 * "Copy as Markdown" behaviour). Returns null when the selection isn't in the
 * preview, so callers fall through to other strategies.
 *
 * Fixes: in preview/reading mode, "select a region, copy" used to copy the
 * **whole document** — the old DOM fallback required the selection to be inside
 * a `.cm-editor` and bailed for the preview pane.
 */
function previewSelectionToSource(content: string): string | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  let anc: Node | null = range.commonAncestorContainer;
  while (anc && anc.nodeType === Node.TEXT_NODE) anc = anc.parentNode;
  const previewRoot = (anc as Element | null)?.closest?.('.preview-content');
  if (!previewRoot) return null;
  const startEl = elementWithSourceLine(range.startContainer);
  if (!startEl) return null;
  const endEl = elementWithSourceLine(range.endContainer) ?? startEl;
  const startLine = sourceLineOf(startEl);
  if (!startLine) return null;
  const endLineAttr = sourceLineOf(endEl) || startLine;
  // Bound the last block: slice up to just before the next annotated block.
  const nextLines = Array.from(
    previewRoot.querySelectorAll<HTMLElement>('[data-source-line],[data-line]'),
  )
    .map(sourceLineOf)
    .filter((n) => n > endLineAttr)
    .sort((a, b) => a - b);
  const lines = content.split(/\r?\n/);
  const endLine = nextLines.length ? nextLines[0] - 1 : lines.length;
  const slice = lines.slice(startLine - 1, Math.max(startLine, endLine)).join('\n');
  return slice.trim() ? slice : null;
}

/**
 * Markdown source for the active selection, or null. Tries, in order:
 *  1. CodeMirror state — editor selections (normal + rectangular).
 *  2. Preview pane — map the rendered selection to source lines (needs the
 *     document `content`, passed by callers).
 *  3. Raw DOM selection text inside a `.cm-editor` (last-resort).
 */
export function getEditorSelectionMd(content?: string): string | null {
  if (typeof document === 'undefined') return null;
  const cmText = cmSelectionText();
  if (cmText) return cmText;
  if (content != null) {
    const previewText = previewSelectionToSource(content);
    if (previewText) return previewText;
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  let node: Node | null = range.commonAncestorContainer;
  while (node && node.nodeType === Node.TEXT_NODE) node = node.parentNode;
  const inEditor = (node as Element | null)?.closest?.('.cm-editor');
  if (!inEditor) return null;
  const text = sel.toString();
  return text.trim() ? text : null;
}
