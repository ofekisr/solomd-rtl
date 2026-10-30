import { computed, inject, onBeforeUnmount, onMounted, onUpdated, ref, type InjectionKey, type Ref } from 'vue';

export const TOOLBAR_MEASURE: InjectionKey<() => void> = Symbol('toolbar-measure');

/** Children call this so their own re-renders re-measure the bar (only the root's `onUpdated` used to). */
export function useMeasureOnUpdate(): void {
  const measure = inject(TOOLBAR_MEASURE, null);
  if (measure) onUpdated(() => measure());
}

/**
 * #282 — the strip scrolls horizontally, but a silently clipped row reads as
 * broken, so the "more" control appears on any window where the bar overflows.
 * The comparison is self-limiting: the button's own width counts toward the
 * overflow that keeps it visible, so it cannot oscillate.
 */
export function useToolbarOverflow(
  toolbarRef: Ref<HTMLElement | null>,
  sheetOpen: Ref<boolean>,
  isNarrow: Ref<boolean>,
) {
  const barOverflows = ref(false);
  let barResizeObserver: ResizeObserver | null = null;

  function measureOverflow(): void {
    const el = toolbarRef.value;
    if (!el || sheetOpen.value) return;
    barOverflows.value = el.scrollWidth > el.clientWidth + 1;
  }

  const showMore = computed(() => isNarrow.value || barOverflows.value);

  onMounted(() => {
    measureOverflow();
    if (typeof ResizeObserver === 'undefined' || !toolbarRef.value) return;
    barResizeObserver = new ResizeObserver(() => measureOverflow());
    barResizeObserver.observe(toolbarRef.value);
  });
  onBeforeUnmount(() => {
    barResizeObserver?.disconnect();
    barResizeObserver = null;
  });
  onUpdated(() => measureOverflow());

  return { barOverflows, showMore, measureOverflow };
}
