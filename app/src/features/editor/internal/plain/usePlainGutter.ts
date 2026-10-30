import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { measureLineHeights } from '../../../../lib/textarea-metrics';
import { useSettingsStore } from '../../../../stores/settings';
import { late, lateRef } from './plain-late.ts';
import type { PlainApiStage1 } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

export function usePlainGutter(deps: PlainDeps, api: PlainApiStage1) {
  const { props, usePlainWindowsEditor } = deps;
  const settings = useSettingsStore();
  const { plainActiveBlock, plainBlockEditors, plainEditor, plainLiveEnabled, plainText } = api;
  const schedulePlainOverlays = late(api, 'schedulePlainOverlays');
  const updatePlainFindBoxes = late(api, 'updatePlainFindBoxes');
  const plainFindBoxes = lateRef(api, 'plainFindBoxes');
  const plainFindOpen = lateRef(api, 'plainFindOpen');

  // #161 — line-number gutter for the plain-textarea path. CodeMirror's
  // lineNumbers() never runs on Windows, so the Show Line Numbers setting silently did
  // nothing there. Numbers get mirror-measured logical-line heights so they
  // stay aligned under soft wrap, and the gutter follows the textarea's
  // scrollTop via a translateY.
  //
  // #203 — the same measured heights also drive the split-view scroll sync
  // (getViewLine / plainScrollToLine). The old `scrollTop ÷ line-height` math
  // counted *visual* rows, so with soft wrap the two panes drifted apart more
  // with every wrapped line — keep the metrics fresh whenever split mode needs
  // them, not only when the gutter is visible.
  const plainLineHeights = ref<number[]>([]);
  const plainScrollTop = ref(0);
  const plainMetricsEnabled = computed(
    () =>
      usePlainWindowsEditor &&
      !plainLiveEnabled.value &&
      // #316 — the focus shade and the drawn caret take their y from the same
      // measured line tops, so they keep the metrics warm too.
      (settings.showLineNumbers ||
        settings.viewMode === 'split' ||
        props.typewriterMode ||
        props.focusMode ||
        settings.solidCursor),
  );
  const plainGutterEnabled = computed(
    () => plainMetricsEnabled.value && settings.showLineNumbers,
  );
  const plainGutterWidth = computed(
    () => `${Math.max(String(plainLineHeights.value.length).length, 2)}ch`,
  );
  let plainGutterTimer: ReturnType<typeof setTimeout> | null = null;
  let plainGutterRO: ResizeObserver | null = null;

  function recomputePlainGutter() {
    if (!plainMetricsEnabled.value) return;
    const el = plainEditor.value;
    if (!el) return;
    try {
      plainLineHeights.value = measureLineHeights(el, plainText.value);
    } catch {
      plainLineHeights.value = [];
    }
  }

  function schedulePlainGutter() {
    if (!plainMetricsEnabled.value) return;
    if (plainGutterTimer) clearTimeout(plainGutterTimer);
    plainGutterTimer = setTimeout(() => {
      plainGutterTimer = null;
      recomputePlainGutter();
    }, 120);
  }

  function onPlainScroll(event: Event) {
    plainScrollTop.value = (event.target as HTMLTextAreaElement).scrollTop;
    // The shade and the drawn caret are positioned against the container, not
    // the scrolled text, so they have to follow the textarea's own scrolling.
    schedulePlainOverlays();
    // So does the find highlight (#330). Cheap: its rects are cached per match.
    if (plainFindBoxes.value.length || plainFindOpen.value) updatePlainFindBoxes();
  }

  watch(
    [plainMetricsEnabled, plainEditor],
    async ([on]) => {
      plainGutterRO?.disconnect();
      plainGutterRO = null;
      if (!on) return;
      await nextTick();
      const el = plainEditor.value;
      if (!el) return;
      plainScrollTop.value = el.scrollTop;
      recomputePlainGutter();
      // Wrap width changes (window resize, sidebar toggle) re-flow soft wrap.
      plainGutterRO = new ResizeObserver(schedulePlainGutter);
      plainGutterRO.observe(el);
    },
    { immediate: true },
  );
  watch(plainText, schedulePlainGutter);
  watch(
    () => [settings.wordWrap, settings.fontSize, settings.fontFamily],
    () => nextTick(schedulePlainGutter),
  );
  onBeforeUnmount(() => {
    plainGutterRO?.disconnect();
    if (plainGutterTimer) clearTimeout(plainGutterTimer);
  });

  // #203 — visual-row-accurate line ↔ scrollTop mapping for the plain textarea.
  // `plainLineHeights` is mirror-measured per logical line (soft wrap included),
  // so its prefix sums are each line's true y offset. `null` while the measured
  // heights are stale (they refresh on a 120ms debounce after edits) or metrics
  // are off — callers then fall back to the uniform-line-height estimate, which
  // is exact when wrap is off.
  const plainLineTops = computed<number[] | null>(() => {
    const heights = plainLineHeights.value;
    if (!heights.length) return null;
    if (heights.length !== (plainText.value || '').split('\n').length) return null;
    const tops = new Array<number>(heights.length);
    let y = 0;
    for (let i = 0; i < heights.length; i++) {
      tops[i] = y;
      y += heights[i];
    }
    return tops;
  });

  function plainPaddingTopPx(el: HTMLTextAreaElement): number {
    const n = Number.parseFloat(window.getComputedStyle(el).paddingTop);
    return Number.isFinite(n) ? n : 0;
  }

  function plainLineHeightPx(): number {
    const editor = plainLiveEnabled.value
      ? plainBlockEditors.value[plainActiveBlock.value]
      : plainEditor.value;
    if (!editor) return Math.max(16, (settings.fontSize || 14) * 1.6);
    const style = window.getComputedStyle(editor);
    const n = Number.parseFloat(style.lineHeight);
    if (Number.isFinite(n) && n > 0) return n;
    const fs = Number.parseFloat(style.fontSize);
    return Number.isFinite(fs) && fs > 0 ? fs * 1.6 : 24;
  }

  return {
    plainLineHeights,
    plainScrollTop,
    plainMetricsEnabled,
    plainGutterEnabled,
    plainGutterWidth,
    recomputePlainGutter,
    schedulePlainGutter,
    onPlainScroll,
    plainLineTops,
    plainPaddingTopPx,
    plainLineHeightPx,
  };
}
