import { mapRenderedPrefixToSource } from './plain-blocks.ts';
import { useTabsStore } from '../../../../stores/tabs';
import { late } from './plain-late.ts';
import type { PlainApiStage9 } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

export function usePlainBlockClicks(deps: PlainDeps, api: PlainApiStage9) {
  const { props } = deps;
  const tabs = useTabsStore();
  const { plainActiveBlock, plainBlocks, plainText, recordPlainHistory } = api;
  const activatePlainBlock = late(api, 'activatePlainBlock');

  /** Visible text from the start of `render` up to the click point, or null. */
  function renderedPrefixAtPoint(render: HTMLElement, x: number, y: number): string | null {
    const doc = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    };
    let node: Node | null = null;
    let offset = 0;
    if (typeof doc.caretRangeFromPoint === 'function') {
      const r = doc.caretRangeFromPoint(x, y);
      if (r) {
        node = r.startContainer;
        offset = r.startOffset;
      }
    } else if (typeof doc.caretPositionFromPoint === 'function') {
      const p = doc.caretPositionFromPoint(x, y);
      if (p) {
        node = p.offsetNode;
        offset = p.offset;
      }
    }
    if (!node || !render.contains(node)) return null;
    const pre = document.createRange();
    pre.selectNodeContents(render);
    try {
      pre.setEnd(node, offset);
    } catch {
      return null;
    }
    return pre.toString();
  }

  function estimatePlainBlockCaretFromClick(index: number, event: MouseEvent): number | undefined {
    const block = plainBlocks.value[index];
    const target = event.currentTarget as HTMLElement | null;
    const render = target?.querySelector('.plain-block__render') as HTMLElement | null;
    if (!block || !render) return undefined;

    // Preferred: map the exact click point in the rendered preview back to a
    // source offset, so a single click lands the caret where the user clicked
    // instead of snapping to the line start.
    const renderedPrefix = renderedPrefixAtPoint(render, event.clientX, event.clientY);
    if (renderedPrefix != null) {
      return mapRenderedPrefixToSource(block.text, renderedPrefix);
    }

    // Fallback: estimate the clicked line from the vertical position and place
    // the caret at that line's start.
    const lines = block.text.split('\n');
    if (lines.length <= 1) return 0;
    const rect = render.getBoundingClientRect();
    const style = window.getComputedStyle(render);
    const lineHeight = Number.parseFloat(style.lineHeight) || (Number.parseFloat(style.fontSize) || 15) * 1.7;
    const lineIndex = Math.max(0, Math.min(lines.length - 1, Math.floor((event.clientY - rect.top) / lineHeight)));
    let caret = 0;
    for (let i = 0; i < lineIndex; i++) caret += lines[i].length + 1;
    return caret;
  }

  function activatePlainBlockFromClick(index: number, event: MouseEvent) {
    // Clicking a rendered task checkbox toggles its source marker instead of
    // entering edit mode.
    const target = event.target as HTMLElement | null;
    if (
      target instanceof HTMLInputElement &&
      target.type === 'checkbox' &&
      target.classList.contains('task-list-item-checkbox')
    ) {
      const render = (event.currentTarget as HTMLElement).querySelector('.plain-block__render');
      const boxes = render
        ? Array.from(render.querySelectorAll('input.task-list-item-checkbox'))
        : [];
      const ordinal = boxes.indexOf(target);
      event.preventDefault();
      if (ordinal >= 0) togglePlainTask(index, ordinal);
      return;
    }
    if (index === plainActiveBlock.value) return;
    // #300 — a drag that selected rendered text ends in a click too. Turning
    // the block into a textarea at that point throws the selection away and
    // moves the page under someone who was only reading (or about to copy).
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().length > 0) return;
    activatePlainBlock(index, estimatePlainBlockCaretFromClick(index, event), true);
  }

  /** Flip the `ordinal`-th task checkbox marker in a block's source, in place. */
  function togglePlainTask(index: number, ordinal: number) {
    const block = plainBlocks.value[index];
    if (!block) return;
    let n = -1;
    const re = /^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/gm;
    const newText = block.text.replace(re, (m, pre, mark, post) => {
      n += 1;
      if (n !== ordinal) return m;
      return `${pre}${mark === ' ' ? 'x' : ' '}${post}`;
    });
    if (newText === block.text) return;
    recordPlainHistory();
    const tail = block.hasTrailingNewline ? '\n' : '';
    const next =
      plainText.value.slice(0, block.start) + newText + tail + plainText.value.slice(block.end);
    plainText.value = next;
    tabs.setContent(props.tab.id, next);
  }

  return {
    renderedPrefixAtPoint,
    estimatePlainBlockCaretFromClick,
    activatePlainBlockFromClick,
    togglePlainTask,
  };
}
