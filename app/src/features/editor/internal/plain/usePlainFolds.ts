import { type FoldAnchor, type HeadingSpan, foldedCharRanges, remapFolds, scanHeadings } from '../../../../lib/heading-fold';
import { type PlainBlock } from './plain-blocks.ts';
import { computed, ref, watch } from 'vue';
import { useSettingsStore } from '../../../../stores/settings';
import { late, lateRef } from './plain-late.ts';
import type { PlainApiStage2 } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

export function usePlainFolds(_deps: PlainDeps, api: PlainApiStage2) {
  const settings = useSettingsStore();
  const { plainActiveBlock, plainLiveEnabled, plainText } = api;
  const activatePlainBlock = late(api, 'activatePlainBlock');
  const plainBlocks = lateRef(api, 'plainBlocks');

  // ---- Heading folding, plain-textarea path --------------------------------
  // CodeMirror keeps folds in editor state; the Windows block editor has none,
  // so folds live here as heading anchors (line + heading text). Anchors survive
  // edits that shift line numbers — a bare line number would collapse whatever
  // section happened to slide into that slot.
  const plainFolds = ref<FoldAnchor[]>([]);

  const plainHeadings = computed<HeadingSpan[]>(() =>
    plainLiveEnabled.value && settings.foldingEnabled ? scanHeadings(plainText.value || '') : [],
  );
  const plainFoldableByStart = computed(() => {
    const map = new Map<number, HeadingSpan>();
    for (const h of plainHeadings.value) if (h.foldable) map.set(h.start, h);
    return map;
  });
  const plainFoldedLines = computed(() => new Set(plainFolds.value.map((f) => f.line)));
  const plainFoldRanges = computed(() =>
    plainFolds.value.length ? foldedCharRanges(plainText.value || '', plainFolds.value.map((f) => f.line)) : [],
  );

  /** Blocks inside a folded section are not rendered. The active block is always
   *  rendered: hiding the textarea the caret lives in would take the caret with
   *  it, and the next keystroke would go nowhere. */
  function plainBlockHidden(block: PlainBlock, index: number): boolean {
    if (index === plainActiveBlock.value) return false;
    const ranges = plainFoldRanges.value;
    if (!ranges.length) return false;
    return ranges.some((r) => block.start > r.from && block.start < r.to);
  }

  function plainHeadingFor(block: PlainBlock): HeadingSpan | null {
    return plainFoldableByStart.value.get(block.start) ?? null;
  }
  function plainHeadingFolded(block: PlainBlock): boolean {
    const h = plainHeadingFor(block);
    return !!h && plainFoldedLines.value.has(h.line);
  }
  /** Lines a folded heading is hiding — shown on the chevron so the collapsed
   *  section advertises its size. */
  function plainHiddenLineCount(block: PlainBlock): number {
    const h = plainHeadingFor(block);
    return h ? h.endLine - h.line : 0;
  }
  function setPlainFold(span: HeadingSpan, folded: boolean) {
    if (folded) {
      if (plainFoldedLines.value.has(span.line)) return;
      // Editing inside a section that is about to disappear would strand the
      // caret in a hidden block, so move it onto the heading first.
      const active = plainBlocks.value[plainActiveBlock.value];
      if (active && active.start > span.headingEnd && active.start <= span.end) {
        const headingIndex = plainBlocks.value.findIndex((b) => b.start === span.start);
        if (headingIndex >= 0) {
          activatePlainBlock(headingIndex, plainBlocks.value[headingIndex]?.text.length ?? 0);
        }
      }
      plainFolds.value = [...plainFolds.value, { line: span.line, title: span.title }];
    } else {
      plainFolds.value = plainFolds.value.filter((f) => f.line !== span.line);
    }
  }
  function togglePlainFold(block: PlainBlock) {
    const h = plainHeadingFor(block);
    if (h) setPlainFold(h, !plainFoldedLines.value.has(h.line));
  }

  // Edits move headings around; re-anchor rather than fold the wrong section.
  watch(plainText, (text) => {
    if (!plainFolds.value.length) return;
    const next = remapFolds(text || '', plainFolds.value);
    const changed =
      next.length !== plainFolds.value.length ||
      next.some((f, i) => f.line !== plainFolds.value[i].line);
    if (changed) plainFolds.value = next;
  });

  return {
    plainFolds,
    plainHeadings,
    plainFoldableByStart,
    plainFoldedLines,
    plainFoldRanges,
    plainBlockHidden,
    plainHeadingFor,
    plainHeadingFolded,
    plainHiddenLineCount,
    setPlainFold,
    togglePlainFold,
  };
}
