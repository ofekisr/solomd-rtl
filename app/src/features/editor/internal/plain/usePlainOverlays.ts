import { activeParagraphLines, lineAt } from '../../../../lib/focus-paragraph';
import { caretPointPx } from '../../../../lib/textarea-metrics';
import { computed, nextTick, ref, watch } from 'vue';
import { useSettingsStore } from '../../../../stores/settings';
import type { PlainApiStage4 } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

export function usePlainOverlays(deps: PlainDeps, api: PlainApiStage4) {
  const { props, usePlainWindowsEditor } = deps;
  const settings = useSettingsStore();
  const { plainActiveBlock, plainBlockEditors, plainComposing, plainEditor, plainGutterEnabled, plainGutterWidth, plainLineHeightPx, plainLineHeights, plainLineTops, plainLiveEnabled, plainLiveHost, plainPaddingTopPx } = api;

  // #199 — typewriter mode for the single-textarea (edit-only / split) plain
  // path; the CodeMirror extension never runs on Windows. Centres the caret's
  // logical line using the same measured line tops as the gutter/scroll-sync.
  function maybePlainTypewriterScroll(line: number) {
    if (!props.typewriterMode || plainLiveEnabled.value) return;
    const el = plainEditor.value;
    if (!el) return;
    const tops = plainLineTops.value;
    const y =
      tops && line <= tops.length
        ? plainPaddingTopPx(el) + tops[line - 1]
        : (line - 1) * plainLineHeightPx();
    const target = Math.max(0, y - el.clientHeight / 2);
    if (Math.abs(el.scrollTop - target) > 4) el.scrollTop = target;
  }

  // Typewriter mode: keep the active block vertically centred (matches the
  // CodeMirror typewriterModeExtension).
  function maybeTypewriterScroll() {
    if (!props.typewriterMode || !plainLiveEnabled.value) return;
    nextTick(() => {
      const host = plainLiveHost.value;
      const el = plainBlockEditors.value[plainActiveBlock.value];
      if (!host || !el) return;
      const hostRect = host.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const delta = elRect.top + elRect.height / 2 - (hostRect.top + hostRect.height / 2);
      if (Math.abs(delta) > 1) host.scrollTop += delta;
    });
  }

  // ---- #316 — Focus mode / solid cursor on the plain <textarea> path ----
  // Both ship as CodeMirror extensions (focusModeExtension, and drawSelection
  // with cursorBlinkRate 0), so on Windows with Vim mode off — where there is
  // no CodeMirror at all — the two switches silently did nothing. Same shape of
  // gap as the line-number gutter (#161) and typewriter mode (#199) before them.
  //
  // Focus mode: the block editor already has one element per paragraph, so it
  // dims by CSS class. The flat editor is a single <textarea> whose lines can't
  // be styled individually, so two shade panels are laid over everything above
  // and below the active paragraph instead — same rendered result as opacity
  // 0.35 on the text, since they are painted in the editor's own background.
  //
  // Solid cursor: no CSS turns off the native caret's blink, so the textarea's
  // caret is made transparent and a non-blinking 2px accent bar is drawn at
  // measured coordinates — matching the CodeMirror cursor. The native caret is
  // only hidden while a drawn one exists (and never mid-IME-composition), so a
  // measurement that comes back empty leaves the user with a blinking caret
  // rather than no caret at all.

  const plainFocusMode = computed(() => usePlainWindowsEditor && props.focusMode);
  const plainSolidCursor = computed(() => usePlainWindowsEditor && settings.solidCursor);

  const plainCaretBox = ref<{ top: number; left: number; height: number } | null>(null);
  const plainWindowFocused = ref(true);
  const plainFocusBand = ref<{ top: number; bottom: number } | null>(null);
  // Hide the native caret only while we are actually drawing one.
  const plainSolidCaretOn = computed(() => !!plainCaretBox.value);
  const plainShadeLeft = computed(() =>
    plainGutterEnabled.value ? `calc(${plainGutterWidth.value} + 21px)` : '0px',
  );

  function plainActiveTextarea(): HTMLTextAreaElement | null {
    return plainLiveEnabled.value
      ? plainBlockEditors.value[plainActiveBlock.value] ?? null
      : plainEditor.value;
  }

  /** Top of the given 1-based logical line, in flat-editor content px. */
  function plainLineTopPx(line: number, lineHeight: number): number {
    const tops = plainLineTops.value;
    if (tops && line >= 1 && line <= tops.length) return tops[line - 1];
    return (line - 1) * lineHeight;
  }

  function computePlainFocusBand() {
    // The block editor dims by class; only the flat textarea needs geometry.
    if (!plainFocusMode.value || plainLiveEnabled.value) {
      plainFocusBand.value = null;
      return;
    }
    const el = plainEditor.value;
    if (!el) {
      plainFocusBand.value = null;
      return;
    }
    const text = el.value;
    const from = el.selectionStart ?? 0;
    const to = el.selectionEnd ?? from;
    const { first, last } = activeParagraphLines(text, from, to);
    const lh = plainLineHeightPx();
    const heights = plainLineHeights.value;
    const padTop = plainPaddingTopPx(el);
    const top = plainLineTopPx(first, lh);
    const lastTop = plainLineTopPx(last, lh);
    const lastHeight = heights.length === text.split('\n').length ? heights[last - 1] ?? lh : lh;
    plainFocusBand.value = {
      top: padTop + top - el.scrollTop,
      bottom: padTop + lastTop + lastHeight - el.scrollTop,
    };
  }

  function computePlainCaretBox() {
    if (!plainSolidCursor.value || plainComposing.value) {
      plainCaretBox.value = null;
      return;
    }
    const el = plainActiveTextarea();
    // No focus, another window in front, or a range selection — the native
    // caret would not be drawn either, so draw nothing.
    //
    // Window focus is tracked from the blur/focus events rather than read from
    // document.hasFocus(): a browser that reports focus wrongly (Unzoo answers
    // false for a frontmost window) would otherwise hide the caret forever,
    // which is the very failure this is fixing. Missing the event instead
    // leaves a caret drawn — visible, not absent.
    if (!el || document.activeElement !== el || !plainWindowFocused.value) {
      plainCaretBox.value = null;
      return;
    }
    const from = el.selectionStart ?? 0;
    if ((el.selectionEnd ?? from) !== from) {
      plainCaretBox.value = null;
      return;
    }
    const container = plainLiveEnabled.value ? plainLiveHost.value : el.parentElement;
    if (!container) {
      plainCaretBox.value = null;
      return;
    }
    const cs = window.getComputedStyle(el);
    const padTop = Number.parseFloat(cs.paddingTop) || 0;
    const padLeft = Number.parseFloat(cs.paddingLeft) || 0;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    try {
      if (plainLiveEnabled.value) {
        // A block holds one paragraph, so mirroring all of it is cheap. The
        // host is the scroll container and the caret is absolutely positioned
        // inside its content, so it scrolls along without a scroll listener.
        const point = caretPointPx(el, el.value, from);
        plainCaretBox.value = {
          top: eRect.top - cRect.top + container.scrollTop + padTop + point.top,
          left: eRect.left - cRect.left + container.scrollLeft + padLeft + point.left,
          height: point.height,
        };
        return;
      }
      // Flat editor: mirror only the caret's own logical line — the whole
      // document would be laid out on every keystroke — and take the line's y
      // from the same measured tops the gutter and scroll sync use.
      const text = el.value;
      const lineStart = text.lastIndexOf('\n', Math.max(0, from - 1)) + 1;
      const nl = text.indexOf('\n', lineStart);
      const lineText = text.slice(lineStart, nl < 0 ? text.length : nl);
      const point = caretPointPx(el, lineText, from - lineStart);
      const top =
        padTop + plainLineTopPx(lineAt(text, from), point.height) + point.top - el.scrollTop;
      // Scrolled out of the textarea's own viewport: nothing to draw.
      if (top + point.height < 0 || top > el.clientHeight) {
        plainCaretBox.value = null;
        return;
      }
      plainCaretBox.value = {
        top: eRect.top - cRect.top + top,
        left: eRect.left - cRect.left + padLeft + point.left - el.scrollLeft,
        height: point.height,
      };
    } catch {
      plainCaretBox.value = null;
    }
  }

  let cleanupPlainOverlays: (() => void) | null = null;
  let plainOverlayRaf = 0;
  /** Repaint the drawn caret and the focus shade, coalesced to one per frame. */
  function schedulePlainOverlays() {
    if (!usePlainWindowsEditor) return;
    if (!plainFocusMode.value && !plainSolidCursor.value) {
      if (plainCaretBox.value) plainCaretBox.value = null;
      if (plainFocusBand.value) plainFocusBand.value = null;
      return;
    }
    if (plainOverlayRaf) return;
    plainOverlayRaf = requestAnimationFrame(() => {
      plainOverlayRaf = 0;
      computePlainFocusBand();
      computePlainCaretBox();
    });
  }

  watch([plainFocusMode, plainSolidCursor, plainLineHeights, plainLiveEnabled], () =>
    schedulePlainOverlays(),
  );

  function installPlainOverlayListeners() {
    // #316 — the drawn caret has to disappear exactly when the native one
    // would. A click into the file tree or the preview fires focusin, and a
    // window that goes to the background fires no blur on the textarea at
    // all, so both are listened for.
    const onFocusShift = () => schedulePlainOverlays();
    const onWindowBlur = () => {
      plainWindowFocused.value = false;
      schedulePlainOverlays();
    };
    const onWindowFocus = () => {
      plainWindowFocused.value = true;
      schedulePlainOverlays();
    };
    document.addEventListener('focusin', onFocusShift);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    cleanupPlainOverlays = () => {
      document.removeEventListener('focusin', onFocusShift);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
    };
  }

  function disposePlainOverlays() {
    cleanupPlainOverlays?.();
    cleanupPlainOverlays = null;
    if (plainOverlayRaf) {
      cancelAnimationFrame(plainOverlayRaf);
      plainOverlayRaf = 0;
    }
  }

  return {
    maybePlainTypewriterScroll,
    maybeTypewriterScroll,
    plainFocusMode,
    plainSolidCursor,
    plainCaretBox,
    plainWindowFocused,
    plainFocusBand,
    plainSolidCaretOn,
    plainShadeLeft,
    plainActiveTextarea,
    plainLineTopPx,
    computePlainFocusBand,
    computePlainCaretBox,
    schedulePlainOverlays,
    installPlainOverlayListeners,
    disposePlainOverlays,
  };
}
