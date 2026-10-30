import type { Ref } from 'vue';

export function usePreviewScroll(host: Ref<HTMLDivElement | null>, emit: (e: 'topline', line: number) => void) {
  /**
   * Scroll the preview pane so the element tagged with `data-source-line="N"`
   * (where N is the nearest line ≤ the requested line) is brought to the top.
   * Used by the outline when viewMode === 'preview' (the editor is unmounted
   * so its gotoLine is unavailable).
   */
  function scrollToLine(line: number) {
    const article = host.value;
    if (!article) return;
    const container = article.parentElement as HTMLElement | null;
    if (!container) return;

    const nodes = Array.from(
      article.querySelectorAll<HTMLElement>('[data-source-line]'),
    );
    if (nodes.length === 0) return;

    // Find the last element whose source-line is ≤ target (binary search).
    let lo = 0;
    let hi = nodes.length - 1;
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const n = Number(nodes[mid].getAttribute('data-source-line') || 0);
      if (n <= line) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    const target = nodes[best];
    // #350 — measure against the scroll container itself. `offsetTop` is
    // relative to the offsetParent, and .preview-host is not positioned, so it
    // also counted the pane chrome above the preview: every jump overshot by
    // that much and the heading ended up hidden above the top edge.
    const delta = target.getBoundingClientRect().top - container.getBoundingClientRect().top;
    container.scrollTo({ top: Math.max(0, container.scrollTop + delta - TOP_GAP), behavior: 'smooth' });
    flashTarget(target);
    emit('topline', Number(target.getAttribute('data-source-line') || line));
  }

  /** Breathing room kept above a jumped-to block. */
  const TOP_GAP = 8;

  /** Briefly mark the block an outline jump landed on (#350). */
  function flashTarget(el: HTMLElement) {
    el.classList.remove('preview-flash');
    // Force a reflow so re-triggering on the same element restarts the animation.
    void el.offsetWidth;
    el.classList.add('preview-flash');
    window.setTimeout(() => el.classList.remove('preview-flash'), 1300);
  }

  // #350 — in preview mode the outline highlights the heading at the top of the
  // preview, not the editor cursor (which does not move while reading). Emits
  // the source line of the last block whose top is at/above the viewport top
  // (plus the jump gap), at most once per frame.
  let toplineRaf = 0;
  function onHostScroll() {
    if (toplineRaf) return;
    toplineRaf = requestAnimationFrame(() => {
      toplineRaf = 0;
      const article = host.value;
      const container = article?.parentElement as HTMLElement | null;
      if (!article || !container) return;
      const limit = container.getBoundingClientRect().top + TOP_GAP + 2;
      let line = 0;
      for (const el of Array.from(article.querySelectorAll<HTMLElement>('[data-source-line]'))) {
        if (el.getBoundingClientRect().top > limit) break;
        line = Number(el.getAttribute('data-source-line') || 0) || line;
      }
      emit('topline', line || 1);
    });
  }

  return { scrollToLine, onHostScroll };
}
