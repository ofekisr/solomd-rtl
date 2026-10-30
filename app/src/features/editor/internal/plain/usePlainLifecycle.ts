import { nextTick, onBeforeUnmount, onMounted, watch } from 'vue';
import { anchorSnapshot, foldAnchorsFor, recallFolds, rememberFolds } from '../../../../lib/fold-memory';
import { readSession } from '../../../../lib/cm-session-restore';
import { registerPlainSelectionGetter } from '../../../../lib/plain-selection';
import { useSettingsStore } from '../../../../stores/settings';
import { useTabsStore } from '../../../../stores/tabs';
import { useThemeStore } from '../../../../stores/theme';
import type { Tab } from '../../../../types';
import type { PlainApi } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

/** Mount/unmount work and the watchers that serve the plain engine: tab
 *  switch (caret/scroll/fold memory), external content, view mode. */
export function usePlainLifecycle(
  deps: PlainDeps,
  api: PlainApi,
  installTextTransformListeners: () => () => void,
) {
  const { props } = deps;
  const {
    closePlainFind, disposePlainOverlays, emitPlainCursorAndSelection, focusPlainEditor,
    installPlainOverlayListeners, plainAbsoluteSelection, plainActiveBlock, plainComposing, plainEditor,
    plainFolds, plainLiveEnabled, plainLiveHost, plainSelectAll, plainSelectionText, plainText,
    processPlainLiveRenderedBlocks, resetPlainHistory, setPlainSelectAllPending,
    syncPlainEditorAfterModeSwitch, syncPlainEditorFromStore,
  } = api;
  const tabs = useTabsStore();
  const settings = useSettingsStore();
  const themeStore = useThemeStore();

  let cleanupTransformCase: (() => void) | null = null;
  let cleanupPlainSelection: (() => void) | null = null;

  function maybeRestoreSession() {
    const saved = readSession(props.tab.id);
    if (!saved || saved === '' || props.tab.content !== '') return;
    if (plainLiveEnabled.value) {
      plainText.value = saved;
      tabs.setContent(props.tab.id, saved);
      return;
    }
    const el = plainEditor.value;
    if (!el || el.value.length > 0) return;
    el.value = saved;
    tabs.setContent(props.tab.id, saved);
    emitPlainCursorAndSelection();
  }

  onMounted(() => {
    cleanupTransformCase = installTextTransformListeners();
    installPlainOverlayListeners();
    syncPlainEditorFromStore(props.tab.content);
    maybeRestoreSession();
    restoreFolds();
    void processPlainLiveRenderedBlocks();
    focusPlainEditor();
    // #126 — let the toolbar AI-rewrite button read this editor's selection
    // (no CodeMirror view exists on this path for it to scan).
    cleanupPlainSelection = registerPlainSelectionGetter(() => {
      const sel = plainAbsoluteSelection();
      const text = plainSelectionText();
      return sel && text ? { selection: text, from: sel.from, to: sel.to } : null;
    });
  });

  onBeforeUnmount(() => {
    saveFolds();
    cleanupTransformCase?.();
    cleanupTransformCase = null;
    cleanupPlainSelection?.();
    cleanupPlainSelection = null;
    disposePlainOverlays();
  });

  // #144 — per-tab caret + scroll memory (runtime-only, per editor pane). The
  // plain textarea's `el.value =` re-sync moves the caret to the END of the
  // document, so the position is saved and restored on tab switches.
  const tabCaretMemory = new Map<string, { caret: number; scrollTop: number }>();

  // Folds are remembered per document (file path, else tab id) rather than per
  // pane, so they also come back when a closed file is reopened this session.
  function foldMemoryKey(tab: Tab): string {
    return tab.filePath ?? tab.id;
  }
  let foldKey = foldMemoryKey(props.tab);

  function saveFolds(): void {
    rememberFolds(foldKey, anchorSnapshot(plainText.value, plainFolds.value));
  }

  function restoreFolds(): void {
    foldKey = foldMemoryKey(props.tab);
    const snapshot = settings.foldingEnabled ? recallFolds(foldKey) : null;
    plainFolds.value = snapshot ? foldAnchorsFor(plainText.value, snapshot) : [];
  }

  // #169 (Windows) — one synchronous scrollTop assignment is not enough on the
  // plain paths: focusPlainEditor() focuses on nextTick, and the browser then
  // scrolls the caret back into view — line 1 when the user only scrolled and
  // never clicked, which is exactly the reported "switch back → reset to top".
  // The live block editor additionally re-renders its blocks asynchronously,
  // growing scrollHeight after the restore. Pin the saved position through that
  // settle window, backing off the moment the user scrolls themselves.
  function restorePlainScroll(saved?: { caret: number; scrollTop: number }) {
    const scroller = (): HTMLElement | null =>
      plainLiveEnabled.value ? plainLiveHost.value : plainEditor.value;
    const el = scroller();
    if (!el) return;
    if (!plainLiveEnabled.value) {
      const ta = el as HTMLTextAreaElement;
      const pos = Math.min(saved?.caret ?? 0, ta.value.length);
      ta.setSelectionRange(pos, pos);
    }
    const st = saved?.scrollTop ?? 0;
    el.scrollTop = st;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
    };
    const intentEvents = ['wheel', 'pointerdown', 'keydown', 'touchstart'] as const;
    for (const ev of intentEvents) el.addEventListener(ev, cancel, { passive: true });
    const reassert = () => {
      const cur = scroller();
      if (!cancelled && cur && Math.abs(cur.scrollTop - st) > 1) cur.scrollTop = st;
    };
    nextTick(() => requestAnimationFrame(reassert));
    setTimeout(reassert, 120);
    setTimeout(reassert, 400);
    setTimeout(() => {
      for (const ev of intentEvents) el.removeEventListener(ev, cancel);
    }, 800);
    setTimeout(reassert, 780);
  }

  function rememberOutgoingTab(oldId: string): void {
    if (plainLiveEnabled.value) {
      tabCaretMemory.set(oldId, {
        caret: 0,
        scrollTop: plainLiveHost.value?.scrollTop ?? 0,
      });
    } else if (plainEditor.value) {
      tabCaretMemory.set(oldId, {
        caret: plainEditor.value.selectionStart ?? 0,
        scrollTop: plainEditor.value.scrollTop,
      });
    }
  }

  watch(
    () => props.tab.id,
    (newId, oldId) => {
      // Snapshot the OUTGOING tab first — at this point the editor DOM/state
      // still holds the old document (re-sync happens below).
      if (oldId) {
        saveFolds();
        rememberOutgoingTab(oldId);
      }
      const saved = newId ? tabCaretMemory.get(newId) : undefined;
      // The Editor component is reused across tabs (no :key), so switching to /
      // creating a document must re-sync content, reset per-document state, and
      // re-focus — otherwise the new doc shows stale text and can't be typed in.
      plainSelectAll.value = false;
      setPlainSelectAllPending(false);
      plainActiveBlock.value = 0;
      resetPlainHistory();
      closePlainFind();
      syncPlainEditorFromStore(props.tab.content);
      maybeRestoreSession();
      restoreFolds();
      void processPlainLiveRenderedBlocks();
      focusPlainEditor();
      // Restore the caret/scroll (default: document START, not end — the
      // `el.value =` assignment above parked it at the end). Block live-edit
      // restores the scroll container only; per-block focus is its own.
      restorePlainScroll(saved);
    },
  );

  watch(
    () => props.tab.content,
    (next) => {
      // The #186 defenses were only ever applied to the CodeMirror branch —
      // without these two guards an external content update reset the caret
      // and killed an in-flight IME composition. Same guards for the textarea.
      if (plainComposing.value) return;
      syncPlainEditorFromStore(next, true);
    },
  );

  watch(
    () => settings.foldingEnabled,
    (on) => {
      if (!on) plainFolds.value = [];
    },
  );

  watch(
    () => settings.viewMode,
    () => {
      syncPlainEditorAfterModeSwitch();
      void processPlainLiveRenderedBlocks();
    },
  );

  // A stale select-all must not survive leaving live edit (the merged single
  // block would greet the user on re-entry).
  watch(plainLiveEnabled, () => {
    plainSelectAll.value = false;
    setPlainSelectAllPending(false);
  });

  watch(
    () => [plainLiveEnabled.value, plainText.value, plainActiveBlock.value, themeStore.revision, settings.language],
    () => {
      // No mermaid.initialize here: the render pass configures it with the
      // current theme itself, and doing it here would load the renderer for a
      // document that has no diagrams.
      void processPlainLiveRenderedBlocks();
    },
    { flush: 'post' },
  );
}
