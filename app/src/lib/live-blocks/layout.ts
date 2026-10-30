import { StateEffect } from '@codemirror/state';

// Block decorations (Decoration.replace with `block: true`) MUST come from a
// StateField — CM6 throws "Block decorations may not be specified via plugins"
// if a ViewPlugin emits them. So this whole module is a state field, not a
// view plugin. `relayoutEffect` lets the async Mermaid render (and any other
// out-of-band trigger) ask the field to recompute.
export const relayoutEffect = StateEffect.define<null>();

// `^\s*!\[<alt>\](<url>)\s*$` — whole-line image with no surrounding prose.
// Why whole-line: replacing inline images would split text in the middle and
// break the natural reading flow of the source. We only collapse images that
// are visually their own paragraph.
export const IMAGE_LINE_RE = /^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/;

// Pipe table heuristic: a header line, a separator (`---` / `:---:`), then
// at least one body row. We don't try to parse the GFM grammar ourselves —
// markdown-it does that — we only need a cheap detector to decide which
// line ranges to swap with widgets.
export function isPipeRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2;
}
export function isSeparatorRow(line: string): boolean {
  const trimmed = line.trim();
  // `| --- | :---: |` etc. Only `:`, `-`, ` `, `|` characters allowed,
  // and at least one `-` per cell.
  return (
    isPipeRow(line) &&
    // `-` must be last in the class so it's a literal, not the range `:`..`|`
    // (which excludes `-` at 0x2D and made every real separator row fail —
    // tables never collapsed to a widget in live-edit).
    /^\|[\s:|-]+\|$/.test(trimmed) &&
    /-{3,}/.test(trimmed)
  );
}

// Images report their real height only after they load, and CM6 does not
// re-measure widget heights on its own — until something else triggers a
// measure, the height map (gutter numbers, scroll anchoring, click→pos
// mapping) is off by the full image height. Nudge the relayout plugin once
// per load burst, and remember natural sizes so re-rendered widgets reserve
// the right box up front (no layout shift at all on subsequent renders —
// `.cm-live-block img { max-width:100%; height:auto }` keeps the attribute
// pair behaving as an aspect-ratio hint, not a fixed size).
export const imageNaturalSizes = new Map<string, { w: number; h: number }>();
let relayoutTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleImageRelayout(): void {
  if (relayoutTimer) return;
  relayoutTimer = setTimeout(() => {
    relayoutTimer = null;
    try {
      window.dispatchEvent(new CustomEvent('solomd:cm-relayout'));
    } catch {}
  }, 50);
}

export function trackImageHeights(root: HTMLElement): void {
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const cached = imageNaturalSizes.get(img.src);
    if (cached && !img.hasAttribute('width') && !img.hasAttribute('height')) {
      img.width = cached.w;
      img.height = cached.h;
    }
    const done = () => {
      if (img.naturalWidth && img.naturalHeight) {
        imageNaturalSizes.set(img.src, { w: img.naturalWidth, h: img.naturalHeight });
      }
      scheduleImageRelayout();
    };
    if (img.complete) {
      // Cache hit: `complete` is already true here, but the box gets its real
      // height only after the (async) decode + this widget entering layout —
      // both past CM's initial measure. Still needs a relayout pass.
      done();
      continue;
    }
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  }
}

export function isLineWithin(line: number, from: number, to: number): boolean {
  return line >= from && line <= to;
}
