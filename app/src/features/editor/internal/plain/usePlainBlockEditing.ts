import { handleTextareaImagePaste } from '../../../../lib/cm-image-paste';
import { nextTick } from 'vue';
import { splitPlainMarkdownBlocks } from './plain-blocks.ts';
import { useTabsStore } from '../../../../stores/tabs';
import type { PlainApiStage10 } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

export function usePlainBlockEditing(deps: PlainDeps, api: PlainApiStage10) {
  const { props, imagePasteOpts } = deps;
  const tabs = useTabsStore();
  const { emitPlainCursorAndSelection, maybeOpenPlainAutocomplete, noteTypedInTextarea, plainActiveBlock, plainBlockEditors, plainBlocks, plainComposing, plainEditor, plainInsertText, plainLineHeightPx, plainLineStartOffset, plainLineTops, plainLiveEnabled, plainLiveHost, plainPaddingTopPx, plainSelectAll, plainSetCaret, plainText, recordPlainHistory, schedulePlainOverlays } = api;

  /**
   * `holdScroll` is for activation by mouse: the block under the pointer must
   * stay under the pointer. Two things used to move it (#300) — the previously
   * active block re-rendering to a different height somewhere above, and
   * focus() scrolling the new textarea into view before it had been sized.
   * Keyboard navigation leaves it off, because there following the caret is the
   * point.
   */
  function activatePlainBlock(index: number, caret?: number, holdScroll = false) {
    const target = Math.max(0, Math.min(index, plainBlocks.value.length - 1));
    const host = plainLiveHost.value;
    const blockEl = holdScroll && host
      ? host.querySelectorAll<HTMLElement>(':scope > .plain-block')[target] ?? null
      : null;
    const topBefore = blockEl ? blockEl.getBoundingClientRect().top : 0;
    plainActiveBlock.value = target;
    nextTick(() => {
      const el = plainBlockEditors.value[plainActiveBlock.value];
      if (!el) return;
      el.focus({ preventScroll: holdScroll });
      if (caret != null) {
        const pos = Math.max(0, Math.min(caret, el.value.length));
        el.setSelectionRange(pos, pos);
      }
      autoSizePlainBlock(el);
      if (blockEl && host && blockEl.isConnected) {
        host.scrollTop += blockEl.getBoundingClientRect().top - topBefore;
      }
      emitPlainCursorAndSelection();
    });
  }

  /**
   * #326 — a click on the editor's blank space (below the last block, or in the
   * gaps between blocks) landed on the host itself, which has no handler: on a
   * new, empty note the whole page ignored clicks and looked frozen. Put the
   * caret at the end of the nearest block — the last one when clicking below
   * the text, which is where every other editor puts it.
   */
  function onPlainLiveHostMouseDown(event: MouseEvent) {
    const host = plainLiveHost.value;
    if (!host || event.button !== 0 || event.target !== host) return;
    const els = host.querySelectorAll<HTMLElement>(':scope > .plain-block');
    if (!els.length) return;
    let best = els.length - 1;
    let bestDist = Infinity;
    els.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = event.clientY < r.top ? r.top - event.clientY : event.clientY > r.bottom ? event.clientY - r.bottom : 0;
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    // Keep the host from taking focus and the browser from starting a text
    // selection on it; the block's textarea gets focus instead.
    event.preventDefault();
    activatePlainBlock(best, Number.MAX_SAFE_INTEGER, true);
  }

  function setPlainBlockEditor(index: number, el: HTMLTextAreaElement | null) {
    plainBlockEditors.value[index] = el;
    if (!el) return;
    const block = plainBlocks.value[index];
    if (block && el.value !== block.text) el.value = block.text;
    nextTick(() => autoSizePlainBlock(el));
  }

  function autoSizePlainBlock(el: HTMLTextAreaElement) {
    // Collapsing to `auto` to measure shortens the whole document for an
    // instant, and the host clamps its scrollTop to that shorter document and
    // does not give it back. Deep inside a tall block (a long code fence) that
    // threw the view a screenful or more upwards (#255, #300).
    const host = plainLiveHost.value;
    const keep = host ? host.scrollTop : 0;
    el.style.height = 'auto';
    el.style.height = `${Math.max(plainLineHeightPx(), el.scrollHeight)}px`;
    if (host && host.scrollTop !== keep) host.scrollTop = keep;
  }

  function handlePlainBlockInput(index: number, event: Event) {
    const el = event.target as HTMLTextAreaElement;
    autoSizePlainBlock(el);
    schedulePlainOverlays();
    if (plainComposing.value) return;
    // Before updatePlainBlock: a re-split can swap this textarea for another.
    noteTypedInTextarea(el, event);
    updatePlainBlock(index, el.value, el.selectionStart ?? el.value.length);
    maybeOpenPlainAutocomplete(el);
  }

  function handlePlainBlockCompositionStart() {
    plainComposing.value = true;
    // Give the native caret back for the duration of the composition: the
    // composed text is drawn by the textarea itself and a measured caret
    // cannot follow it.
    schedulePlainOverlays();
  }

  function handlePlainBlockCompositionEnd(index: number, event: CompositionEvent) {
    plainComposing.value = false;
    schedulePlainOverlays();
    const el = event.target as HTMLTextAreaElement;
    autoSizePlainBlock(el);
    updatePlainBlock(index, el.value, el.selectionStart ?? el.value.length);
  }

  /**
   * Apply an edit expressed against the FULL document source (not a single block)
   * and restore the caret at an absolute offset. Used by block-boundary
   * Backspace / Delete, where the deletion crosses a block separator and so can't
   * be modelled as a single-block `updatePlainBlock`. Mirrors updatePlainBlock's
   * re-split + caret-restore tail so the active <textarea> follows the caret.
   */
  function applyPlainFullEdit(next: string, absoluteCaret: number) {
    plainSelectAll.value = false; // full edits land in normal block view
    if (!plainComposing.value) recordPlainHistory();
    plainText.value = next;
    tabs.setContent(props.tab.id, next);
    const nextBlocks = splitPlainMarkdownBlocks(next);
    let found = nextBlocks.findIndex(
      (candidate) => absoluteCaret >= candidate.start && absoluteCaret < candidate.end,
    );
    if (found < 0) found = nextBlocks.length - 1;
    plainActiveBlock.value = found;
    nextTick(() => {
      const activeBlock = plainBlocks.value[plainActiveBlock.value];
      const el = plainBlockEditors.value[plainActiveBlock.value];
      if (!el) return;
      if (document.activeElement !== el) el.focus();
      autoSizePlainBlock(el);
      if (activeBlock) {
        const pos = Math.max(0, Math.min(absoluteCaret - activeBlock.start, el.value.length));
        el.setSelectionRange(pos, pos);
      }
      emitPlainCursorAndSelection();
    });
  }

  /** Enter select-all mode: merge the doc into one block and native-select it. */
  function enterPlainSelectAll() {
    if (plainSelectAll.value) {
      // Repeated Ctrl+A after the user collapsed part of the selection by
      // shift-arrowing etc. — just re-select within the merged textarea.
      plainBlockEditors.value[plainActiveBlock.value]?.select();
      return;
    }
    plainSelectAllPending = true;
    plainSelectAll.value = true;
    plainActiveBlock.value = 0;
    nextTick(() => {
      const el = plainBlockEditors.value[0];
      if (!el) {
        plainSelectAllPending = false;
        plainSelectAll.value = false;
        return;
      }
      // Order matters: focus() synchronously dispatches a focus event, which
      // funnels into maybeExitPlainSelectAll — the still-collapsed selection
      // must not read as "user dismissed it". Keep `pending` up until the
      // range is actually set.
      el.focus();
      el.select();
      plainSelectAllPending = false;
      autoSizePlainBlock(el);
      emitPlainCursorAndSelection();
    });
  }

  /**
   * Leave select-all mode once the selection collapses (click / arrow key / Esc):
   * re-split into blocks and land the caret in the block that now contains it.
   * Editing while everything is selected exits through updatePlainBlock /
   * applyPlainFullEdit instead (the native input event replaces the selection).
   */
  function maybeExitPlainSelectAll() {
    if (!plainSelectAll.value || plainSelectAllPending) return;
    const el = plainBlockEditors.value[plainActiveBlock.value];
    if (!el) return;
    const caret = el.selectionStart ?? 0;
    if (caret !== (el.selectionEnd ?? 0)) return; // still a range — stay
    plainSelectAll.value = false;
    const blocks = splitPlainMarkdownBlocks(plainText.value || '');
    let found = blocks.findIndex((b) => caret >= b.start && caret < b.end);
    if (found < 0) found = blocks.length - 1;
    plainActiveBlock.value = found;
    nextTick(() => {
      const activeBlock = plainBlocks.value[plainActiveBlock.value];
      const el2 = plainBlockEditors.value[plainActiveBlock.value];
      if (!el2) return;
      if (document.activeElement !== el2) el2.focus();
      autoSizePlainBlock(el2);
      if (activeBlock) {
        const pos = Math.max(0, Math.min(caret - activeBlock.start, el2.value.length));
        el2.setSelectionRange(pos, pos);
      }
      emitPlainCursorAndSelection();
    });
  }

  function updatePlainBlock(index: number, text: string, caret?: number) {
    const block = plainBlocks.value[index];
    if (!block) return;
    // An edit while everything is selected (type-over, Ctrl+X, Delete via native
    // selection replacement) ends select-all mode; the re-split below then runs
    // against normal block boundaries. `block` above was captured from the
    // merged view, so offsets stay consistent for this edit.
    const wasSelectAll = plainSelectAll.value;
    plainSelectAll.value = false;
    // Snapshot the pre-edit document for undo (coalesced) before we mutate it.
    if (!plainComposing.value) recordPlainHistory();
    const nextCaret = block.start + (caret ?? text.length);
    // Re-attach the block separator that splitPlainMarkdownBlocks stripped from
    // the editable text, so neighbouring blocks don't merge on every edit.
    const tail = block.hasTrailingNewline ? '\n' : '';
    const next = `${plainText.value.slice(0, block.start)}${text}${tail}${plainText.value.slice(block.end)}`;
    plainText.value = next;
    tabs.setContent(props.tab.id, next);
    const nextBlocks = splitPlainMarkdownBlocks(next);
    // Locate the block that now holds the caret. Use a half-open range
    // [start, end): when the caret sits exactly on a block boundary (e.g. after
    // pressing Enter at a line end) it belongs to the *following* block — the new
    // line — not the end of the previous one, otherwise the caret appears stuck.
    // Fall back to the block being edited (clamped) when nothing matches — e.g.
    // the caret is at the very document end — rather than snapping to block 0,
    // which would deactivate the edited block and flip it into preview mode.
    let found = nextBlocks.findIndex(
      (candidate) => nextCaret >= candidate.start && nextCaret < candidate.end,
    );
    // A half-open search can't match the caret when it sits at the very end of the
    // document (including the zero-width trailing empty-line block) — land it on
    // the last block there.
    if (found < 0) found = nextBlocks.length - 1;
    const nextIndex = found;
    const nextBlock = nextBlocks[nextIndex];
    plainActiveBlock.value = nextIndex;
    // Fast path only when the block is structurally unchanged. We must also
    // confirm the new block text matches what the <textarea> already holds:
    // typing can split one block into several (e.g. a char before a list "- "
    // marker turns that line into a paragraph). When that happens the inline
    // :ref re-runs setPlainBlockEditor and rewrites el.value to the now-shorter
    // block text, which collapses the caret to the line end — so we must fall
    // through to the nextTick branch and restore the caret explicitly.
    // Never fast-path out of select-all mode: the merged block's :key
    // ('select-all') differs from the re-split block's, so the <textarea>
    // REMOUNTS even when index/start/text all match (e.g. select-all → delete
    // everything, or type-over a doc that re-splits to one block). Skipping the
    // nextTick would leave focus on <body> and swallow every subsequent
    // keystroke — caught by real-key testing in the Windows VM.
    if (!wasSelectAll && nextIndex === index && nextBlock?.start === block.start && nextBlock?.text === text) {
      emitPlainCursorAndSelection();
      return;
    }
    nextTick(() => {
      const activeBlock = plainBlocks.value[plainActiveBlock.value];
      const el = plainBlockEditors.value[plainActiveBlock.value];
      if (!el) return;
      // The active block changed to a different <textarea> (e.g. a re-split moved
      // the caret into another block, or Enter created a new line). The old
      // textarea unmounted, dropping focus to <body>, which leaves the caret
      // invisible and swallows subsequent keystrokes — so re-focus the new one.
      if (document.activeElement !== el) el.focus();
      autoSizePlainBlock(el);
      if (activeBlock) {
        const pos = Math.max(0, Math.min(nextCaret - activeBlock.start, el.value.length));
        el.setSelectionRange(pos, pos);
      }
      emitPlainCursorAndSelection();
    });
  }

  function plainScrollToLine(line: number) {
    if (plainLiveEnabled.value) {
      plainSetCaret(plainLineStartOffset(Math.floor(line)));
      return;
    }
    const el = plainEditor.value;
    if (!el) return;
    const safeLine = Math.max(1, Math.floor(line));
    const frac = Math.max(0, Math.min(line - safeLine, 0.999));
    const tops = plainLineTops.value;
    if (tops && safeLine <= tops.length) {
      const i = safeLine - 1;
      const h = i + 1 < tops.length ? tops[i + 1] - tops[i] : plainLineHeightPx();
      // 8px top margin matches the CodeMirror path and the preview pane's own
      // 8px offset — the old 40px here left the panes ~32px apart at rest.
      el.scrollTop = Math.max(0, plainPaddingTopPx(el) + tops[i] + frac * h - 8);
    } else {
      el.scrollTop = Math.max(0, (safeLine - 1 + frac) * plainLineHeightPx() - 8);
    }
    syncPlainLiveScroll();
  }

  function syncPlainLiveScroll() {
    emitPlainCursorAndSelection();
  }

  function handlePlainPaste(event: ClipboardEvent) {
    // Clipboard image paste (Ctrl+V of a screenshot). Text paste falls through to
    // the textarea's native handling. plainInsertText records its own undo step.
    void handleTextareaImagePaste(event, imagePasteOpts(), (text) => plainInsertText(text));
  }

  // Entry runs across a nextTick (mount the merged textarea, then select()).
  // Events firing in between (the Ctrl+A keyup, the focus emit) see a collapsed
  // selection and must not be mistaken for "user collapsed it — exit".
  let plainSelectAllPending = false;

  function setPlainSelectAllPending(value: boolean) {
    plainSelectAllPending = value;
  }

  return {
    activatePlainBlock,
    onPlainLiveHostMouseDown,
    setPlainBlockEditor,
    autoSizePlainBlock,
    handlePlainBlockInput,
    handlePlainBlockCompositionStart,
    handlePlainBlockCompositionEnd,
    applyPlainFullEdit,
    enterPlainSelectAll,
    maybeExitPlainSelectAll,
    updatePlainBlock,
    plainScrollToLine,
    syncPlainLiveScroll,
    handlePlainPaste,
    setPlainSelectAllPending,
  };
}
