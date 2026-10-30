import { buildEditorFontStack, useSettingsStore } from '../../../../stores/settings';
import { computed, nextTick, ref } from 'vue';
import { useFormatHints } from '../../../../composables/useFormatHints';
import { useTabsStore } from '../../../../stores/tabs';
import { late, lateRef } from './plain-late.ts';
import type { PlainApiStage0 } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

export function createPlainState(deps: PlainDeps, api: PlainApiStage0) {
  const { props, usePlainWindowsEditor } = deps;
  const tabs = useTabsStore();
  const settings = useSettingsStore();
  const activatePlainBlock = late(api, 'activatePlainBlock');
  const autoSizePlainBlock = late(api, 'autoSizePlainBlock');
  const maybeExitPlainSelectAll = late(api, 'maybeExitPlainSelectAll');
  const maybeOpenPlainAutocomplete = late(api, 'maybeOpenPlainAutocomplete');
  const maybePlainTypewriterScroll = late(api, 'maybePlainTypewriterScroll');
  const maybeTypewriterScroll = late(api, 'maybeTypewriterScroll');
  const schedulePlainOverlays = late(api, 'schedulePlainOverlays');
  const syncPlainLiveScroll = late(api, 'syncPlainLiveScroll');
  const updatePlainBlock = late(api, 'updatePlainBlock');
  const plainBlocks = lateRef(api, 'plainBlocks');

  const noteTypedFormat = useFormatHints();
  function noteTypedInTextarea(el: HTMLTextAreaElement, event: Event) {
    const ie = event as InputEvent;
    if (props.tab.language !== 'markdown') return;
    if (ie.inputType !== 'insertText' || !ie.data || ie.data.length !== 1) return;
    const caret = el.selectionStart ?? 0;
    const lineStart = el.value.lastIndexOf('\n', caret - 1) + 1;
    noteTypedFormat(el.value.slice(lineStart, caret), ie.data);
  }

  const plainEditor = ref<HTMLTextAreaElement | null>(null);
  const plainLiveHost = ref<HTMLDivElement | null>(null);
  const plainBlockEditors = ref<Record<number, HTMLTextAreaElement | null>>({});
  const plainText = ref(props.tab.content || '');
  const plainActiveBlock = ref(0);
  // Select-all in the block live editor (user feedback, 4.8.10): native Ctrl+A
  // inside the active block's <textarea> can only reach that block, so "Select All"
  // was impossible in live edit. While this flag is on, plainBlocks collapses
  // the document into a single active block (see the computed below).
  const plainSelectAll = ref(false);

  const plainComposing = ref(false);

  const plainLiveEnabled = computed(
    () => usePlainWindowsEditor && settings.viewMode === 'liveEdit' && props.tab.language === 'markdown',
  );

  const plainEditorStyle = computed(() => ({
    '--plain-editor-font-size': `${settings.fontSize || 14}px`,
    '--plain-editor-font-family': buildEditorFontStack(settings.fontFamily),
    '--plain-preview-font-size': `${settings.previewFontSize || settings.fontSize || 15}px`,
  }));

  function plainSelectionText(): string {
    if (plainLiveEnabled.value) {
      const el = plainBlockEditors.value[plainActiveBlock.value];
      if (!el) return '';
      const from = el.selectionStart ?? 0;
      const to = el.selectionEnd ?? 0;
      return from === to ? '' : el.value.slice(from, to);
    }
    const el = plainEditor.value;
    if (!el) return '';
    const from = el.selectionStart ?? 0;
    const to = el.selectionEnd ?? 0;
    return from === to ? '' : el.value.slice(from, to);
  }

  function emitPlainCursorAndSelection() {
    // Every selection-ish event in both plain paths funnels through here, so
    // it is also where the focus shade and the drawn caret get repainted.
    schedulePlainOverlays();
    if (plainLiveEnabled.value) {
      // Select-all mode ends the moment the user collapses the selection
      // (click into the text, arrow key); this is the single choke point all
      // the textarea's selection-ish events (keyup/mouseup/select) run through.
      maybeExitPlainSelectAll();
      const el = plainBlockEditors.value[plainActiveBlock.value];
      const block = plainBlocks.value[plainActiveBlock.value];
      if (!el || !block) return;
      const head = el.selectionStart ?? 0;
      const before = plainText.value.slice(0, block.start) + el.value.slice(0, head);
      const lines = before.split('\n');
      const line = lines.length;
      const col = lines[lines.length - 1]?.length ?? 0;
      deps.emitCursor(line, col + 1);
      deps.emitSelection(plainSelectionText());
      maybeTypewriterScroll();
      return;
    }
    const el = plainEditor.value;
    if (!el) return;
    const head = el.selectionStart ?? 0;
    const lines = el.value.slice(0, head).split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1]?.length ?? 0;
    deps.emitCursor(line, col + 1);
    deps.emitSelection(plainSelectionText());
    maybePlainTypewriterScroll(line);
  }

  function plainSetCaret(pos: number) {
    if (plainLiveEnabled.value) {
      const blocks = plainBlocks.value;
      const found = blocks.findIndex((block) => pos >= block.start && pos <= block.end);
      const index = found < 0 ? 0 : found;
      activatePlainBlock(index, Math.max(0, pos - (blocks[index]?.start ?? 0)));
      return;
    }
    const el = plainEditor.value;
    if (!el) return;
    const safe = Math.max(0, Math.min(pos, el.value.length));
    el.focus();
    el.setSelectionRange(safe, safe);
    emitPlainCursorAndSelection();
  }

  function plainLineStartOffset(line: number): number {
    if (plainLiveEnabled.value) {
      const lines = plainText.value.split('\n');
      const safeLine = Math.max(1, Math.min(line, lines.length));
      let offset = 0;
      for (let i = 1; i < safeLine; i++) offset += lines[i - 1].length + 1;
      return offset;
    }
    const el = plainEditor.value;
    if (!el) return 0;
    const safeLine = Math.max(1, Math.min(line, el.value.split('\n').length));
    if (safeLine <= 1) return 0;
    let offset = 0;
    let current = 1;
    while (current < safeLine && offset < el.value.length) {
      const next = el.value.indexOf('\n', offset);
      if (next < 0) return el.value.length;
      offset = next + 1;
      current++;
    }
    return offset;
  }

  function plainInsertText(snippet: string) {
    if (plainLiveEnabled.value) {
      const index = plainActiveBlock.value;
      const el = plainBlockEditors.value[index];
      if (!el) return;
      const start = el.selectionStart ?? 0;
      const end = el.selectionEnd ?? 0;
      const nextBlock = `${el.value.slice(0, start)}${snippet}${el.value.slice(end)}`;
      updatePlainBlock(index, nextBlock, start + snippet.length);
      return;
    }
    const el = plainEditor.value;
    if (!el) return;
    recordPlainHistory();
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const next = `${el.value.slice(0, start)}${snippet}${el.value.slice(end)}`;
    el.value = next;
    const caret = start + snippet.length;
    el.setSelectionRange(caret, caret);
    plainText.value = next;
    tabs.setContent(props.tab.id, next);
    emitPlainCursorAndSelection();
  }

  function focusPlainEditor() {
    // Plain editors don't take focus on their own (the CodeMirror path calls
    // view.focus()). Without this, a freshly opened/created document has focus on
    // <body> and keystrokes go nowhere until the user clicks the editor.
    nextTick(() => {
      const el = plainLiveEnabled.value
        ? plainBlockEditors.value[plainActiveBlock.value]
        : plainEditor.value;
      el?.focus();
    });
  }

  function syncPlainEditorFromStore(text: string, preserveCaret = false) {
    const el = plainEditor.value;
    plainText.value = text;
    if (!el) {
      // #281 — the flat textarea may not exist *yet*. Watchers run before Vue
      // patches the DOM, so a tab switch that also flips `plainLiveEnabled`
      // (leaving live-edit markdown for a plain-text file) reaches here while
      // the `v-if` still holds the block-editor branch and this ref is null.
      // Bailing out left the gutter populated — it renders from `plainText`,
      // assigned just above — while the textarea that mounted a tick later was
      // empty: the "content blank but line numbers shown" report. Finish the
      // write once the branch has mounted, unless a newer document has since
      // claimed the editor.
      nextTick(() => {
        const late = plainEditor.value;
        if (!late || plainText.value !== text) return;
        if (late.value !== text) late.value = text;
        emitPlainCursorAndSelection();
        syncPlainLiveScroll();
      });
      return;
    }
    if (el.value !== text) {
      // Assigning `.value` on a <textarea> destroys the selection, so an
      // external content update (a cloud client touching the file, a sync pull,
      // a save round-trip) used to yank the caret away mid-sentence. Callers
      // that are reconciling an *external* change keep the caret where the user
      // left it; callers that are loading a different document (tab switch,
      // mount) pass false and position it themselves.
      const from = el.selectionStart;
      const to = el.selectionEnd;
      const hadFocus = document.activeElement === el;
      el.value = text;
      if (preserveCaret) {
        const a = Math.min(from ?? 0, text.length);
        const b = Math.min(to ?? a, text.length);
        el.setSelectionRange(a, b);
        // Re-assert focus: some engines drop it when `.value` is replaced, and
        // a blurred textarea sends the user's next keystrokes to the document,
        // where single letters hit global handlers instead of being typed.
        if (hadFocus && document.activeElement !== el) el.focus();
      }
    }
    nextTick(() => {
      emitPlainCursorAndSelection();
      syncPlainLiveScroll();
    });
  }

  function syncPlainEditorAfterModeSwitch() {
    if (!usePlainWindowsEditor) return;
    nextTick(() => {
      if (plainLiveEnabled.value) {
        const block = plainBlocks.value[plainActiveBlock.value];
        const el = plainBlockEditors.value[plainActiveBlock.value];
        if (block && el && el.value !== block.text) el.value = block.text;
        if (el) autoSizePlainBlock(el);
        emitPlainCursorAndSelection();
        return;
      }
      const el = plainEditor.value;
      if (!el) return;
      if (el.value !== plainText.value) el.value = plainText.value;
      emitPlainCursorAndSelection();
      syncPlainLiveScroll();
    });
  }

  function handlePlainInput(event: Event) {
    if (plainLiveEnabled.value) return;
    const el = event.target as HTMLTextAreaElement;
    if (!plainComposing.value) recordPlainHistory();
    plainText.value = el.value;
    tabs.setContent(props.tab.id, el.value);
    emitPlainCursorAndSelection();
    // Gitee IK6JCC — the / ⁠[[ # @ autocomplete used to be wired only to the
    // live-edit *block* editor, so on Windows (which is on this plain-textarea
    // path unless Vim mode is on) it silently did nothing in Edit-only / Split mode.
    // Same trigger the block editor uses.
    maybeOpenPlainAutocomplete(el);
    if (!plainComposing.value) noteTypedInTextarea(el, event);
    nextTick(syncPlainLiveScroll);
  }

  // ---- Plain editor: document-level undo/redo (the WebView2-safe textarea path
  // has no CodeMirror history). Snapshots are the whole document + an absolute
  // caret offset, with rapid edits coalesced into one step. ----
  type PlainSnapshot = { content: string; caret: number };
  const plainUndoStack: PlainSnapshot[] = [];
  let plainRedoStack: PlainSnapshot[] = [];
  let plainHistoryTs = 0;

  function plainAbsoluteCaret(): number {
    if (plainLiveEnabled.value) {
      const el = plainBlockEditors.value[plainActiveBlock.value];
      const block = plainBlocks.value[plainActiveBlock.value];
      if (!el || !block) return plainText.value.length;
      return block.start + (el.selectionStart ?? 0);
    }
    const el = plainEditor.value;
    return el ? el.selectionStart ?? el.value.length : plainText.value.length;
  }

  function recordPlainHistory() {
    const now = Date.now();
    const top = plainUndoStack[plainUndoStack.length - 1];
    if (top && top.content === plainText.value) {
      plainHistoryTs = now;
      return;
    }
    // Coalesce bursts of typing into a single undo step.
    if (plainUndoStack.length && now - plainHistoryTs < 500) {
      plainHistoryTs = now;
      return;
    }
    plainUndoStack.push({ content: plainText.value, caret: plainAbsoluteCaret() });
    if (plainUndoStack.length > 300) plainUndoStack.shift();
    plainRedoStack = [];
    plainHistoryTs = now;
  }

  function applyPlainContent(content: string, caret: number) {
    plainText.value = content;
    tabs.setContent(props.tab.id, content);
    const safe = Math.max(0, Math.min(caret, content.length));
    if (!plainLiveEnabled.value) {
      nextTick(() => {
        const el = plainEditor.value;
        if (el) {
          if (el.value !== content) el.value = content;
          el.focus();
          el.setSelectionRange(safe, safe);
        }
        emitPlainCursorAndSelection();
      });
      return;
    }
    nextTick(() => plainSetCaret(safe));
  }

  function plainUndo() {
    if (!plainUndoStack.length) return;
    plainRedoStack.push({ content: plainText.value, caret: plainAbsoluteCaret() });
    const prev = plainUndoStack.pop() as PlainSnapshot;
    plainHistoryTs = 0;
    applyPlainContent(prev.content, prev.caret);
  }

  function plainRedo() {
    if (!plainRedoStack.length) return;
    plainUndoStack.push({ content: plainText.value, caret: plainAbsoluteCaret() });
    const next = plainRedoStack.pop() as PlainSnapshot;
    plainHistoryTs = 0;
    applyPlainContent(next.content, next.caret);
  }

  function resetPlainHistory() {
    plainUndoStack.length = 0;
    plainRedoStack = [];
    plainHistoryTs = 0;
  }

  return {
    noteTypedFormat,
    noteTypedInTextarea,
    plainEditor,
    plainLiveHost,
    plainBlockEditors,
    plainText,
    plainActiveBlock,
    plainSelectAll,
    plainComposing,
    plainLiveEnabled,
    plainEditorStyle,
    plainSelectionText,
    emitPlainCursorAndSelection,
    plainSetCaret,
    plainLineStartOffset,
    plainInsertText,
    focusPlainEditor,
    syncPlainEditorFromStore,
    syncPlainEditorAfterModeSwitch,
    handlePlainInput,
    plainUndoStack,
    plainAbsoluteCaret,
    recordPlainHistory,
    applyPlainContent,
    plainUndo,
    plainRedo,
    resetPlainHistory,
  };
}
