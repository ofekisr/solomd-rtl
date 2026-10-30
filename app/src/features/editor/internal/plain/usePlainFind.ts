import { caretTopPx } from '../../../../lib/textarea-metrics';
import { findPlainMatches } from './plain-search.ts';
import { nextTick } from 'vue';
import { late } from './plain-late.ts';
import type { PlainApiStage6 } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

export function usePlainFind(_deps: PlainDeps, api: PlainApiStage6) {
  const { applyPlainContent, emitPlainCursorAndSelection, pinPlainBlockInView, plainActiveBlock, plainBlockEditors, plainBlocks, plainEditor, plainFindBoxes, plainFindCaseSensitive, plainFindDodge, plainFindInput, plainFindOpen, plainFindQuery, plainLiveEnabled, plainLiveHost, plainMatchIndex, plainMatches, plainPaddingTopPx, plainReplaceValue, plainSelectionText, plainText, recordPlainHistory, updatePlainFindBoxes } = api;
  const autoSizePlainBlock = late(api, 'autoSizePlainBlock');

  // Where the caret was when the find bar opened: typing a query jumps to the
  // first match from here on, the way Notepad and VS Code do, not from the top.
  let plainFindAnchor = 0;

  function plainCaretDocOffset(): number {
    if (plainLiveEnabled.value) {
      const el = plainBlockEditors.value[plainActiveBlock.value];
      const b = plainBlocks.value[plainActiveBlock.value];
      return b ? b.start + (el?.selectionStart ?? 0) : 0;
    }
    return plainEditor.value?.selectionStart ?? 0;
  }

  function runPlainSearch() {
    const q = plainFindQuery.value;
    if (!q) {
      plainMatches.value = [];
      plainMatchIndex.value = 0;
      return;
    }
    const out = findPlainMatches(plainText.value, q, plainFindCaseSensitive.value);
    plainMatches.value = out;
    if (plainMatchIndex.value >= out.length) plainMatchIndex.value = 0;
  }

  function openPlainFind() {
    const wasOpen = plainFindOpen.value;
    plainFindOpen.value = true;
    if (!wasOpen) plainFindAnchor = plainCaretDocOffset();
    const selected = plainSelectionText();
    if (selected && !selected.includes('\n')) plainFindQuery.value = selected;
    nextTick(() => {
      plainFindInput.value?.focus();
      plainFindInput.value?.select();
      revealPlainMatchFromAnchor();
    });
  }

  /**
   * Close the bar. From Esc / ✕ (`toMatch`) the editor takes focus with the
   * current match selected, so you land where you searched to — the one moment
   * the editor gets focus from the find bar. Closing because the tab changed
   * must not: the match belongs to the previous document.
   */
  function closePlainFind(toMatch = false) {
    const m = plainMatches.value[plainMatchIndex.value];
    plainFindOpen.value = false;
    plainFindBoxes.value = [];
    plainFindDodge.value = false;
    if (toMatch && m && plainFindQuery.value) selectPlainRange(m.start, m.end, true);
  }

  /** Jump to the first match at or after where the caret was when the bar opened. */
  function revealPlainMatchFromAnchor() {
    runPlainSearch();
    const ms = plainMatches.value;
    if (!ms.length) {
      plainFindBoxes.value = [];
      return;
    }
    const i = ms.findIndex((m) => m.start >= plainFindAnchor);
    plainMatchIndex.value = i < 0 ? 0 : i;
    const m = ms[plainMatchIndex.value];
    selectPlainRange(m.start, m.end);
  }

  /** Enter → next match, Shift+Enter → previous; focus stays in the box. */
  function onPlainFindEnter(event: KeyboardEvent) {
    // The Enter that commits an IME candidate is the IME's, not ours.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    gotoPlainMatch(event.shiftKey ? -1 : 1);
  }

  function onPlainFindInput(value: string, composing = false) {
    plainFindQuery.value = value;
    // Not mid-IME-composition: moving the editor's selection while a Chinese
    // IME is composing in this box cancels the composition, and the typed
    // characters vanish. Jump once the composition commits (compositionend).
    if (composing) return;
    revealPlainMatchFromAnchor();
  }

  /**
   * Select [start, end) in the plain editor and scroll it to the middle of the
   * view. The editor is only focused when `focusEditor` is set: stepping
   * through matches must leave focus in the find box, or the next Enter lands
   * in the document and replaces the match with a line break (#330).
   */
  function selectPlainRange(start: number, end: number, focusEditor = false) {
    if (plainLiveEnabled.value) {
      const blocks = plainBlocks.value;
      const bi = blocks.findIndex((b) => start >= b.start && start < b.end);
      plainActiveBlock.value = bi < 0 ? Math.max(0, blocks.length - 1) : bi;
      nextTick(() => {
        const el = plainBlockEditors.value[plainActiveBlock.value];
        const b = plainBlocks.value[plainActiveBlock.value];
        if (!el || !b) return;
        // preventScroll: focus() otherwise scrolls the whole textarea into view
        // — for a tall block, its top — and the view visibly bounced from there
        // back to the match (#330).
        if (focusEditor) el.focus({ preventScroll: true });
        const s = Math.max(0, Math.min(start - b.start, el.value.length));
        const e = Math.max(s, Math.min(end - b.start, el.value.length));
        el.setSelectionRange(s, e);
        // Centre the *match*, not the block: a block can be a several-screen
        // code fence or paragraph, and centring that leaves the match off-screen.
        // Size it first — a just-mounted textarea is still two rows tall, and the
        // host would clamp the scroll to a document that short.
        autoSizePlainBlock(el);
        const host = plainLiveHost.value;
        if (host) {
          const y = el.getBoundingClientRect().top - host.getBoundingClientRect().top
            + plainPaddingTopPx(el) + caretTopPx(el, el.value, s);
          host.scrollTop = Math.max(0, host.scrollTop + y - host.clientHeight / 2);
        } else {
          el.scrollIntoView({ block: 'center' });
        }
        emitPlainCursorAndSelection();
        updatePlainFindBoxes();
        pinPlainBlockInView();
      });
      return;
    }
    const el = plainEditor.value;
    if (!el) return;
    if (focusEditor) el.focus({ preventScroll: true });
    el.setSelectionRange(start, end);
    // #255 — setSelectionRange() selects but never scrolls a <textarea>, so in a
    // long document the counter moved ("3/12") while the view stayed put.
    el.scrollTop = Math.max(0, plainPaddingTopPx(el) + caretTopPx(el, el.value, start) - el.clientHeight / 2);
    emitPlainCursorAndSelection();
    updatePlainFindBoxes();
  }

  function gotoPlainMatch(delta: number) {
    if (!plainMatches.value.length) {
      runPlainSearch();
      if (!plainMatches.value.length) return;
    }
    const n = plainMatches.value.length;
    plainMatchIndex.value = ((plainMatchIndex.value + delta) % n + n) % n;
    const m = plainMatches.value[plainMatchIndex.value];
    if (m) selectPlainRange(m.start, m.end);
  }

  function replacePlainCurrent() {
    const m = plainMatches.value[plainMatchIndex.value];
    if (!m) return;
    recordPlainHistory();
    const r = plainReplaceValue.value;
    const next = plainText.value.slice(0, m.start) + r + plainText.value.slice(m.end);
    applyPlainContent(next, m.start + r.length);
    nextTick(() => {
      runPlainSearch();
      if (plainMatches.value.length) {
        if (plainMatchIndex.value >= plainMatches.value.length) plainMatchIndex.value = 0;
        const nm = plainMatches.value[plainMatchIndex.value];
        if (nm) selectPlainRange(nm.start, nm.end);
      } else {
        plainFindBoxes.value = [];
      }
    });
  }

  function replacePlainAll() {
    if (!plainFindQuery.value || !plainMatches.value.length) return;
    recordPlainHistory();
    const r = plainReplaceValue.value;
    let result = '';
    let last = 0;
    for (const m of plainMatches.value) {
      result += plainText.value.slice(last, m.start) + r;
      last = m.end;
    }
    result += plainText.value.slice(last);
    applyPlainContent(result, result.length);
    nextTick(runPlainSearch);
  }

  return {
    plainCaretDocOffset,
    runPlainSearch,
    openPlainFind,
    closePlainFind,
    revealPlainMatchFromAnchor,
    onPlainFindEnter,
    onPlainFindInput,
    selectPlainRange,
    gotoPlainMatch,
    replacePlainCurrent,
    replacePlainAll,
  };
}
