import { syntaxTree } from '@codemirror/language';
import type { Range } from '@codemirror/state';
import { Decoration, type DecorationSet, type EditorView } from '@codemirror/view';
import { findInlineHtmlSpans, findMarkSpans, maskInlineCode } from '../html-live-render.ts';
import { diagramFenceKind, fenceModeField } from './fence-modes.ts';
import {
  bulletDeco, hrDeco, CodeCopyWidget, CodeModeWidget, codeBlockClipboardText, listItemHasTask, type MdSyntaxNode,
} from './live-widgets.ts';
import {
  HIDDEN_MARK_NODES, headingClass, strongMark, emMark, strikeMark, codeMark, codeRevealedMark, codeTickMark, linkMark,
  htmlMarkMark, inlineHtmlMark, fencedPosition, quoteLine, fencedLine, fenceLangMark, headingLine, hideDeco, markerMark,
} from './live-decos.ts';

const HEADING_LEVELS: Record<string, number> = {
  ATXHeading1: 1, ATXHeading2: 2, ATXHeading3: 3,
  ATXHeading4: 4, ATXHeading5: 5, ATXHeading6: 6,
  SetextHeading1: 1, SetextHeading2: 2,
};

export function buildDecorations(view: EditorView, showMarkers = false): DecorationSet {
  const sel = view.state.selection.main;
  const fromLine = view.state.doc.lineAt(sel.from).number;
  const toLine = view.state.doc.lineAt(sel.to).number;
  const tree = syntaxTree(view.state);

  // We collect into a flat list of `Range<Decoration>` and then call
  // `Decoration.set(ranges, /* sort */ true)` — that's the documented
  // forgiving path for adding line + mark decorations together. The
  // `sort=true` arg lets CM6 sort by (from, startSide) for us, which is
  // necessary because line and mark decorations have different sides.
  const ranges: Range<Decoration>[] = [];

  const seenQuoteLines = new Set<number>();
  const seenFencedLines = new Set<number>();
  const seenCopyBlocks = new Set<number>();
  const seenHeadingLines = new Set<number>();
  const seenInlineHtmlLines = new Set<number>();

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;
        const nFrom = node.from;
        const nTo = node.to;
        const lineAtNode = view.state.doc.lineAt(nFrom).number;
        const lineEndAtNode = view.state.doc.lineAt(
          Math.min(nTo, view.state.doc.length),
        ).number;
        const fenceParent = node.node.parent?.name === 'FencedCode' ? node.node.parent : null;
        // A fence's ``` lines reveal while the caret is anywhere in the block,
        // so the block's start and end stay visible while editing it.
        const caretTouches = fenceParent
          ? view.state.doc.lineAt(Math.min(fenceParent.to, view.state.doc.length)).number >= fromLine
            && view.state.doc.lineAt(fenceParent.from).number <= toLine
          : lineEndAtNode >= fromLine && lineAtNode <= toLine;

        // ---- Marker hiding (off-line only) ----
        if (HIDDEN_MARK_NODES.has(name)) {
          const isInlineTick = name === 'CodeMark' && node.node.parent?.name === 'InlineCode';
          if (isInlineTick && (showMarkers || caretTouches) && nTo > nFrom) {
            ranges.push(codeTickMark.range(nFrom, nTo));
          }
          if (showMarkers) {
            // Dimmed, never removed — so the line looks the same whether or
            // not the caret is on it (#353).
            if (nTo > nFrom) ranges.push(markerMark.range(nFrom, nTo));
            return;
          }
          if (fenceParent && caretTouches && nTo > nFrom) {
            ranges.push(markerMark.range(nFrom, nTo));
            return;
          }
          if (name === 'CodeInfo' && fenceParent && nTo > nFrom) {
            ranges.push(fenceLangMark.range(nFrom, nTo));
            return;
          }
          if (!caretTouches && nTo > nFrom) {
            // v4.3.5 #83 — for ATX heading marks (`#`, `##`, …) also hide
            // the single trailing space that separates the marker from
            // the heading text. Without this, the space character remains
            // and renders at the heading line's font-size, so H1 (1.85em
            // space) visibly indents further than H4 (1.1em space) etc.
            // Headings end up looking left-staggered instead of aligned.
            let hideTo = nTo;
            if (name === 'HeaderMark') {
              const line = view.state.doc.lineAt(nFrom);
              // Setext headings put `HeaderMark` on the underline (---/===)
              // line, with no following space to eat. Only widen for ATX.
              if (line.from === nFrom && nTo - nFrom <= 6) {
                const after = view.state.doc.sliceString(nTo, Math.min(nTo + 1, view.state.doc.length));
                if (after === ' ') hideTo = nTo + 1;
              }
            }
            ranges.push(hideDeco.range(nFrom, hideTo));
          }
          return;
        }

        // ---- URL: hide only when it's the destination part of a real
        //      `[label](url)` link. Autolinks (`<https://x.com>`) make
        //      the URL the visible text, so we leave it alone there. ----
        if (name === 'URL') {
          const parent = node.node.parent;
          const inLabeledLink = parent && parent.name === 'Link';
          if (inLabeledLink && !showMarkers && !caretTouches && nTo > nFrom) {
            ranges.push(hideDeco.range(nFrom, nTo));
          }
          return;
        }

        // ---- Headings: line class for sizing + heading mark on text ----
        if (HEADING_LEVELS[name]) {
          const level = HEADING_LEVELS[name];
          const lineObj = view.state.doc.lineAt(nFrom);
          if (!seenHeadingLines.has(lineObj.from)) {
            seenHeadingLines.add(lineObj.from);
            ranges.push(headingLine(level).range(lineObj.from));
          }
          if (nFrom < nTo) {
            ranges.push(
              headingClass(level).range(nFrom, Math.min(nTo, view.state.doc.length)),
            );
          }
          return;
        }

        // ---- Inline strong / emphasis / strike ----
        if (name === 'StrongEmphasis' && nFrom < nTo) {
          ranges.push(strongMark.range(nFrom, nTo));
          return;
        }
        if (name === 'Emphasis' && nFrom < nTo) {
          ranges.push(emMark.range(nFrom, nTo));
          return;
        }
        if (name === 'Strikethrough' && nFrom < nTo) {
          ranges.push(strikeMark.range(nFrom, nTo));
          return;
        }

        // ---- Inline code ----
        if (name === 'InlineCode' && nFrom < nTo) {
          ranges.push((showMarkers || caretTouches ? codeRevealedMark : codeMark).range(nFrom, nTo));
          return;
        }

        // ---- Links ----
        if (name === 'Link' && nFrom < nTo) {
          ranges.push(linkMark.range(nFrom, nTo));
          return;
        }

        // ---- Blockquote line styling ----
        if (name === 'Blockquote') {
          const startLine = view.state.doc.lineAt(nFrom).number;
          const endLine = view.state.doc.lineAt(
            Math.min(nTo, view.state.doc.length),
          ).number;
          for (let ln = startLine; ln <= endLine; ln++) {
            const lineObj = view.state.doc.line(ln);
            if (!seenQuoteLines.has(lineObj.from)) {
              seenQuoteLines.add(lineObj.from);
              ranges.push(quoteLine.range(lineObj.from));
            }
          }
          return;
        }

        // ---- Fenced code block background + copy button ----
        if (name === 'FencedCode' || name === 'CodeBlock') {
          const startLine = view.state.doc.lineAt(nFrom).number;
          const endLine = view.state.doc.lineAt(
            Math.min(nTo, view.state.doc.length),
          ).number;
          const isActive = endLine >= fromLine && startLine <= toLine;
          for (let ln = startLine; ln <= endLine; ln++) {
            const lineObj = view.state.doc.line(ln);
            if (!seenFencedLines.has(lineObj.from)) {
              seenFencedLines.add(lineObj.from);
              ranges.push(fencedLine(fencedPosition(ln, startLine, endLine), isActive).range(lineObj.from));
            }
          }
          // v4.11.18 — the copy button rides the block's first line and is
          // positioned into its top-right corner by CSS. Only emit it when
          // that line is inside the range we're building decorations for
          // (ViewPlugin decorations must stay within the viewport), and only
          // once per block when a block straddles two visible ranges.
          const firstLine = view.state.doc.line(startLine);
          if (
            firstLine.from >= from
            && firstLine.from <= to
            && !seenCopyBlocks.has(firstLine.from)
          ) {
            seenCopyBlocks.add(firstLine.from);
            const code = codeBlockClipboardText(
              view.state.doc,
              name === 'FencedCode',
              startLine,
              endLine,
            );
            if (code.trim()) {
              if (diagramFenceKind(firstLine.text)) {
                const mode = view.state.field(fenceModeField, false)?.get(firstLine.from) ?? 'edit';
                ranges.push(
                  Decoration.widget({
                    widget: new CodeModeWidget(firstLine.from, mode),
                    side: -2,
                  }).range(firstLine.from),
                );
              }
              ranges.push(
                Decoration.widget({
                  widget: new CodeCopyWidget(code),
                  side: -1,
                }).range(firstLine.from),
              );
            }
          }
          return;
        }

        // ---- List markers (v4.7.1) ----
        // Bullets (`-`/`*`/`+`) become a • glyph; ordered numbers stay; a
        // task item's dash is hidden so the checkbox widget leads. Revealed
        // (raw) on the caret line so the marker stays editable.
        if (name === 'ListMark') {
          if (showMarkers || caretTouches || nTo <= nFrom) return;
          const mark = view.state.doc.sliceString(nFrom, nTo);
          const isBullet = mark === '-' || mark === '*' || mark === '+';
          if (!isBullet) return; // ordered list ("1.", "2)") keeps its number
          if (listItemHasTask(node.node as unknown as MdSyntaxNode)) {
            // Hide "- " (dash + trailing space) — the checkbox renders the item.
            const after = view.state.doc.sliceString(
              nTo,
              Math.min(nTo + 1, view.state.doc.length),
            );
            ranges.push(hideDeco.range(nFrom, after === ' ' ? nTo + 1 : nTo));
          } else {
            ranges.push(bulletDeco.range(nFrom, nTo));
          }
          return;
        }

        // ---- Horizontal rule (v4.7.1): `---` / `***` / `___` → <hr> ----
        if (name === 'HorizontalRule') {
          if (showMarkers || caretTouches || nTo <= nFrom) return;
          ranges.push(hrDeco.range(nFrom, nTo));
          return;
        }
      },
    });

    // Paired inline HTML is valid Markdown, but CodeMirror's live editor used
    // to leave tags such as `<strong>` and `<sup>` visible; ditto the
    // markdown-it-mark `==highlight==` the preview renders (#199). Hide the
    // paired markers and style their contents while the caret is off the
    // line. Moving the caret onto the line reveals the exact source for
    // editing. Fenced-code lines and inline-code spans are skipped — they
    // must show their source verbatim.
    const firstVisibleLine = view.state.doc.lineAt(from).number;
    const lastVisibleLine = view.state.doc.lineAt(
      Math.min(to, view.state.doc.length),
    ).number;
    for (let lineNo = firstVisibleLine; lineNo <= lastVisibleLine; lineNo += 1) {
      if (seenInlineHtmlLines.has(lineNo)) continue;
      seenInlineHtmlLines.add(lineNo);
      if (!showMarkers && lineNo >= fromLine && lineNo <= toLine) continue;
      const line = view.state.doc.line(lineNo);
      if (seenFencedLines.has(line.from)) continue;
      const base = line.from;
      const scanText = maskInlineCode(line.text);
      const tagDeco = showMarkers ? markerMark : hideDeco;
      for (const span of findInlineHtmlSpans(scanText)) {
        ranges.push(tagDeco.range(base + span.openFrom, base + span.openTo));
        if (span.contentTo > span.contentFrom) {
          ranges.push(
            inlineHtmlMark(span.kind).range(
              base + span.contentFrom,
              base + span.contentTo,
            ),
          );
        }
        ranges.push(tagDeco.range(base + span.closeFrom, base + span.closeTo));
      }
      for (const span of findMarkSpans(scanText)) {
        ranges.push(tagDeco.range(base + span.openFrom, base + span.openTo));
        ranges.push(
          htmlMarkMark.range(base + span.contentFrom, base + span.contentTo),
        );
        ranges.push(tagDeco.range(base + span.closeFrom, base + span.closeTo));
      }
    }
  }

  // sort = true so CM6 handles (from, side) ordering regardless of the
  // mixed line/mark/replace decorations we collected.
  return Decoration.set(ranges, true);
}
