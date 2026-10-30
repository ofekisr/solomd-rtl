import { caretPointPx } from '../../../../lib/textarea-metrics';
import { nextTick, ref, watch } from 'vue';
import { late } from './plain-late.ts';
import type { PlainApiStage5 } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

export function usePlainFindBoxes(_deps: PlainDeps, api: PlainApiStage5) {
  const { plainActiveBlock, plainActiveTextarea, plainBlockEditors, plainBlocks, plainLiveEnabled, plainLiveHost, plainText } = api;
  const runPlainSearch = late(api, 'runPlainSearch');

  // ---- Plain editor: in-document find / replace (the textarea path has no
  // CodeMirror search panel). Matches are computed over the whole document;
  // navigating selects the match in the right block. ----
  const plainFindOpen = ref(false);
  const plainFindQuery = ref('');
  const plainReplaceValue = ref('');
  const plainFindCaseSensitive = ref(false);
  const plainFindInput = ref<HTMLInputElement | null>(null);
  const plainMatches = ref<Array<{ start: number; end: number }>>([]);
  const plainMatchIndex = ref(0);

  // #330 — the current match, drawn. Focus stays in the find box while you step
  // through matches (so Enter means "next", not "replace the match with a line
  // break"), and a <textarea> paints no selection while it is unfocused.
  const plainFindBoxes = ref<Array<{ top: number; left: number; width: number; height: number }>>([]);
  // Docks the find bar at the bottom while the current match sits under it.
  const plainFindDodge = ref(false);
  const plainFindBar = ref<HTMLElement | null>(null);

  // #330 — "it finds the right place, then bounces up a few lines". Blocks above
  // the match keep changing height after the jump: the block that was being
  // edited goes back to rendered HTML, and code highlighting, maths and diagrams
  // render asynchronously. The browser's scroll anchoring absorbs some of that,
  // but only for changes above its anchor node — near the top of the view — so
  // a block that grows between there and the match still pushes the match out
  // of the spot it was scrolled to. For a moment after a jump, follow the match:
  // whatever it moved on screen, scroll by the same. Stops once the user
  // scrolls, clicks or types.
  let plainPinRaf = 0;
  let plainPinStop: (() => void) | null = null;
  function pinPlainBlockInView() {
    plainPinStop?.();
    const host = plainLiveHost.value;
    if (!host) return;
    // Re-read the active textarea each frame rather than holding one: the block
    // list re-renders around a jump, and a stale element reports a stale place.
    const current = () => plainBlockEditors.value[plainActiveBlock.value] ?? null;
    const topOf = () => {
      const el = current();
      return el ? el.getBoundingClientRect().top - host.getBoundingClientRect().top : null;
    };
    let last = topOf();
    const until = performance.now() + 1500;
    const stop = () => {
      cancelAnimationFrame(plainPinRaf);
      plainPinRaf = 0;
      host.removeEventListener('wheel', stop);
      host.removeEventListener('pointerdown', stop);
      host.removeEventListener('keydown', stop);
      if (plainPinStop === stop) plainPinStop = null;
    };
    plainPinStop = stop;
    host.addEventListener('wheel', stop, { passive: true });
    host.addEventListener('pointerdown', stop);
    host.addEventListener('keydown', stop);
    let lastEl = current();
    const tick = () => {
      const now = topOf();
      if (now == null || last == null || performance.now() > until) {
        stop();
        return;
      }
      const el = current();
      if (Math.abs(now - last) > 0.5) {
        host.scrollTop += now - last;
        last = topOf();
      }
      // A new element needs its highlight measured again.
      if (el !== lastEl) updatePlainFindBoxes();
      lastEl = el;
      plainPinRaf = requestAnimationFrame(tick);
    };
    plainPinRaf = requestAnimationFrame(tick);
  }

  // Flat editor: the match's rects in text-flow px, cached so that scrolling
  // only re-positions them — measuring means laying the whole document out in
  // the mirror, which is fine once per jump and not once per scroll frame.
  let plainFindFlowCache: {
    text: string;
    start: number;
    end: number;
    width: number;
    rects: Array<{ top: number; left: number; width: number; height: number }>;
  } | null = null;

  function matchFlowRects(el: HTMLTextAreaElement, text: string, s: number, e: number) {
    const a = caretPointPx(el, text, s);
    const b = caretPointPx(el, text, e);
    if (Math.abs(a.top - b.top) < a.height / 2) {
      return [{ top: a.top, left: a.left, width: Math.max(2, b.left - a.left), height: a.height }];
    }
    // Soft-wrapped across rows: to the end of the first row, from the start of
    // the last. (A query has no line breaks, so it spans two rows at most in
    // practice.)
    const cs = window.getComputedStyle(el);
    const contentW = el.clientWidth
      - (Number.parseFloat(cs.paddingLeft) || 0) - (Number.parseFloat(cs.paddingRight) || 0);
    return [
      { top: a.top, left: a.left, width: Math.max(2, contentW - a.left), height: a.height },
      { top: b.top, left: 0, width: Math.max(2, b.left), height: b.height },
    ];
  }

  /** Re-draw the current-match highlight (and dodge the bar if it covers it). */
  function updatePlainFindBoxes() {
    const m = plainFindOpen.value && plainFindQuery.value
      ? plainMatches.value[plainMatchIndex.value]
      : null;
    const el = plainActiveTextarea();
    if (!m || !el) {
      plainFindBoxes.value = [];
      return;
    }
    const cs = window.getComputedStyle(el);
    const padTop = Number.parseFloat(cs.paddingTop) || 0;
    const padLeft = Number.parseFloat(cs.paddingLeft) || 0;
    let boxes: Array<{ top: number; left: number; width: number; height: number }>;
    if (plainLiveEnabled.value) {
      const b = plainBlocks.value[plainActiveBlock.value];
      const block = el.parentElement;
      if (!b || !block || m.start < b.start || m.end > b.end) {
        plainFindBoxes.value = [];
        return;
      }
      // Relative to the block the boxes are rendered in (see the template).
      const bRect = block.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const ox = eRect.left - bRect.left + padLeft;
      const oy = eRect.top - bRect.top + padTop;
      boxes = matchFlowRects(el, el.value, m.start - b.start, m.end - b.start)
        .map((r) => ({ ...r, left: r.left + ox, top: r.top + oy }));
    } else {
      const text = el.value;
      const width = el.clientWidth;
      const c = plainFindFlowCache;
      const rects = c && c.text === text && c.start === m.start && c.end === m.end && c.width === width
        ? c.rects
        : matchFlowRects(el, text, m.start, m.end);
      plainFindFlowCache = { text, start: m.start, end: m.end, width, rects };
      const container = el.parentElement;
      if (!container) {
        plainFindBoxes.value = [];
        return;
      }
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const ox = eRect.left - cRect.left + padLeft - el.scrollLeft;
      const oy = eRect.top - cRect.top + padTop - el.scrollTop;
      boxes = rects
        .map((r) => ({ ...r, left: r.left + ox, top: r.top + oy }))
        // Scrolled out of the textarea's own viewport: nothing to draw.
        .filter((r) => r.top + r.height > eRect.top - cRect.top && r.top < eRect.bottom - cRect.top);
    }
    plainFindBoxes.value = boxes;
    nextTick(updatePlainFindDodge);
  }

  // #330 — "the find box covers what I searched for". Centring keeps a match
  // clear of the bar except near the very top of the document, where there is
  // no room to scroll it lower; there, the bar steps aside to the bottom.
  function updatePlainFindDodge() {
    const bar = plainFindBar.value;
    const el = plainActiveTextarea();
    if (!bar || !el || !plainFindBoxes.value.length) {
      plainFindDodge.value = false;
      return;
    }
    // Both editors lay the boxes out in the textarea's parent (the block, or the
    // flat editor's frame); the bar is positioned in its own offset parent.
    // Compare in viewport coordinates.
    const container = el.parentElement;
    const frame = bar.offsetParent as HTMLElement | null;
    if (!container || !frame) return;
    const cRect = container.getBoundingClientRect();
    const fRect = frame.getBoundingClientRect();
    // Judge against where the bar sits when docked at the top (top: 8px,
    // right: 16px), whichever way it is docked now — or it would flip back and
    // forth between the two.
    const barRight = fRect.right - 16;
    const barLeft = barRight - bar.offsetWidth;
    const barTop = fRect.top + 8;
    const barBottom = barTop + bar.offsetHeight;
    plainFindDodge.value = plainFindBoxes.value.some((r) => {
      const top = cRect.top + r.top;
      const left = cRect.left + r.left;
      return top < barBottom && top + r.height > barTop && left + r.width > barLeft && left < barRight;
    });
  }

  // Edits made while the bar is open (typing in the document, undo, a replace)
  // move every match after them; recount so the counter and the highlight stay
  // on real text instead of on stale offsets.
  watch(plainText, () => {
    if (!plainFindOpen.value || !plainFindQuery.value) return;
    runPlainSearch();
    plainFindFlowCache = null;
    nextTick(updatePlainFindBoxes);
  });

  return {
    plainFindOpen,
    plainFindQuery,
    plainReplaceValue,
    plainFindCaseSensitive,
    plainFindInput,
    plainMatches,
    plainMatchIndex,
    plainFindBoxes,
    plainFindDodge,
    plainFindBar,
    pinPlainBlockInView,
    matchFlowRects,
    updatePlainFindBoxes,
    updatePlainFindDodge,
  };
}
