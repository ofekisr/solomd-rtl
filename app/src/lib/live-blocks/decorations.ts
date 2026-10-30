import { RangeSetBuilder, EditorState } from '@codemirror/state';
import { Decoration, type DecorationSet } from '@codemirror/view';
import { isLocalSvgPath, resolveImagePath, resolveImageSrc } from '../image-resolve.ts';
import { findHtmlBlockEnd } from '../html-live-render.ts';
import { findInlineFences } from '../inline-fence.ts';
import { plantumlSvgUrl } from '../plantuml.ts';
import { diagramFenceKind, fenceModeField, splitSideField } from '../cm-fence-modes.ts';
import { parseTldrawFence, TLDRAW_DEFAULT_HEIGHT } from '../tldraw-board.ts';
import { IMAGE_LINE_RE, isPipeRow, isSeparatorRow } from './layout.ts';
import { ImageWidget, TableWidget, HtmlBlockWidget, MathWidget, InlineMathWidget, inlineMathSpans } from './widgets.ts';
import { PlantumlWidget } from './diagram-widgets.ts';
import { type MindmapBuildContext, mindmapFencesByCmLine, addMindmapDecoration } from './mindmap-widget.ts';
import { TldrawWidget } from './tldraw-widget.ts';
import { type BlockOptions } from './options.ts';
import { addDiagramFence } from './diagram-fences.ts';

export function buildBlockDecorations(state: EditorState, opts: BlockOptions): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        const sel = state.selection.main;
        const cursorLine = state.doc.lineAt(sel.from).number;
        const cursorLineEnd = state.doc.lineAt(sel.to).number;
        const keepSource = opts.keepSource?.() === true;

        // Single pass over the whole doc — for each line, decide:
        //   * is it a standalone image line we should replace? (1 line)
        //   * is it the start of a table block we should collapse? (N lines)
        // Tables are walked as ranges so we don't double-iterate. (We walk
        // the full doc, not just the viewport: block decorations come from a
        // state field, which has no viewport — and CM only renders the
        // visible slice anyway, so this stays cheap.)
        const doc = state.doc;
        const lastLine = doc.lines;
        const sourceLines = Array.from(
          { length: lastLine },
          (_, index) => doc.line(index + 1).text,
        );
        const inlineFences = findInlineFences(sourceLines);
        const mindmapFences = mindmapFencesByCmLine(doc);
        const mindmapContext: MindmapBuildContext = { doc, cursorLine, cursorLineEnd, keepSource, opts };
        let i = 1;
        while (i <= lastLine) {
          const mindmapFence = mindmapFences.get(i);
          if (mindmapFence) {
            i = addMindmapDecoration(builder, mindmapFence, mindmapContext);
            continue;
          }
          const line = doc.line(i);

          // Single-line fence (```lang; code```): a code block while the
          // caret is elsewhere, its source line once the caret enters.
          if (inlineFences.has(i - 1)) {
            const cursorInside = keepSource || (i >= cursorLine && i <= cursorLineEnd);
            if (!cursorInside) {
              builder.add(
                line.from,
                line.to,
                Decoration.replace({ widget: new TableWidget(line.text, 'code'), block: true }),
              );
            }
            i += 1;
            continue;
          }

          // Raw block HTML (`<div>…</div>`, `<details>`, HTML tables, etc.).
          // Preview.vue has always rendered this through markdown-it, but live
          // edit previously left the tags visible. Collapse the complete block
          // while the caret is outside; entering it reveals the source again.
          const htmlEndIndex = findHtmlBlockEnd(sourceLines, i - 1);
          if (htmlEndIndex !== null) {
            const endI = htmlEndIndex + 1;
            const cursorInside =
              keepSource ||
              (cursorLine >= i && cursorLine <= endI) ||
              (cursorLineEnd >= i && cursorLineEnd <= endI);
            if (!cursorInside) {
              const blockFrom = line.from;
              const blockTo = doc.line(endI).to;
              const source = doc.sliceString(blockFrom, blockTo);
              builder.add(
                blockFrom,
                blockTo,
                Decoration.replace({
                  widget: new HtmlBlockWidget(
                    source,
                    opts.getImageRoot?.() ?? null,
                    opts.getFilePath?.(),
                  ),
                  block: true,
                }),
              );
            }
            i = endI + 1;
            continue;
          }

          // Image line.
          const imgMatch = IMAGE_LINE_RE.exec(line.text);
          if (imgMatch) {
            if (keepSource) {
              // Render below the source line and leave the line alone, so
              // clicking into it changes nothing on screen.
              const root = opts.getImageRoot?.() ?? null;
              const filePath = opts.getFilePath?.();
              const src = resolveImageSrc(imgMatch[2], root, filePath);
              const localPath = resolveImagePath(imgMatch[2], root, filePath);
              builder.add(
                line.to,
                line.to,
                Decoration.widget({
                  widget: new ImageWidget(src, imgMatch[1], isLocalSvgPath(localPath) ? localPath : null),
                  block: true,
                  side: 1,
                }),
              );
              i += 1;
              continue;
            }
            const cursorInside = i >= cursorLine && i <= cursorLineEnd;
            if (!cursorInside) {
              const alt = imgMatch[1];
              const rawSrc = imgMatch[2];
              const root = opts.getImageRoot?.() ?? null;
              const filePath = opts.getFilePath?.();
              const src = resolveImageSrc(rawSrc, root, filePath);
              const localPath = resolveImagePath(rawSrc, root, filePath);
              builder.add(
                line.from,
                line.to,
                Decoration.replace({
                  widget: new ImageWidget(src, alt, isLocalSvgPath(localPath) ? localPath : null),
                  block: true,
                }),
              );
            }
            i += 1;
            continue;
          }

          // v4.3.0 issue #57a — block math (`$$…$$`).
          // Recognise either inline `$$E=mc^2$$` on a single line OR a
          // multi-line block opened with a `$$` line and closed with a `$$`
          // line. We only collapse if the cursor is outside.
          const trimmedLine = line.text.trim();
          if (trimmedLine.startsWith('$$')) {
            // Single-line `$$ ... $$`?
            if (trimmedLine.endsWith('$$') && trimmedLine.length > 4) {
              const cursorInside = keepSource || cursorLine === i || cursorLineEnd === i;
              if (!cursorInside) {
                builder.add(
                  line.from,
                  line.to,
                  Decoration.replace({
                    widget: new MathWidget(line.text),
                    block: true,
                  }),
                );
              }
              i += 1;
              continue;
            }
            // Multi-line block — scan forward for the closing `$$` line.
            let endI = i + 1;
            while (endI <= lastLine) {
              const next = doc.line(endI);
              if (next.text.trim().startsWith('$$')) break;
              endI += 1;
            }
            if (endI <= lastLine) {
              const cursorInside = keepSource || (cursorLine >= i && cursorLine <= endI);
              const cursorInsideEnd = cursorLineEnd >= i && cursorLineEnd <= endI;
              if (!cursorInside && !cursorInsideEnd) {
                const blockFrom = doc.line(i).from;
                const blockTo = doc.line(endI).to;
                const source = doc.sliceString(blockFrom, blockTo);
                builder.add(
                  blockFrom,
                  blockTo,
                  Decoration.replace({
                    widget: new MathWidget(source),
                    block: true,
                  }),
                );
              }
              i = endI + 1;
              continue;
            }
          }

          // v4.6 F7 — ```tldraw fenced whiteboard. The fence carries
          // id/height/width attributes and a variable-length backtick run
          // (3+, grown past backticks inside the JSON). Unlike every other
          // block here there is NO cursor-inside gating: the board always
          // replaces the fence (the JSON is never hand-edited), so the canvas
          // stays mounted while you type around it.
          const tldrawOpen = /^\s*(`{3,})\s*tldraw\b([^\n]*)$/i.exec(line.text);
          if (tldrawOpen) {
            const ticks = tldrawOpen[1].length;
            const closeRe = new RegExp(`^\\s*\`{${ticks},}\\s*$`);
            let endI = i + 1;
            while (endI <= lastLine && !closeRe.test(doc.line(endI).text)) {
              endI += 1;
            }
            if (endI <= lastLine) {
              const info = `tldraw${tldrawOpen[2]}`;
              let body = '';
              for (let k = i + 1; k < endI; k++) {
                body += (k > i + 1 ? '\n' : '') + doc.line(k).text;
              }
              const fence = parseTldrawFence(info, body) ?? {
                boardId: '',
                height: TLDRAW_DEFAULT_HEIGHT,
                width: '',
                snapshot: body.trim(),
              };
              const blockFrom = doc.line(i).from;
              const blockTo = doc.line(endI).to;
              builder.add(
                blockFrom,
                blockTo,
                Decoration.replace({
                  widget: new TldrawWidget(
                    fence.boardId,
                    fence.height,
                    fence.width,
                    fence.snapshot,
                    opts,
                  ),
                  block: true,
                }),
              );
              i = endI + 1;
              continue;
            }
          }

          // v4.3.0 issue #57a — ```mermaid and ```dot / ```graphviz / ```gv
          // fences. Each renders async into its cache; the widget asks CM to
          // rebuild once the SVG is ready. The per-block view mode (edit /
          // split / preview) decides what shows — see cm-fence-modes.ts.
          const diagramKind = diagramFenceKind(line.text);
          if (diagramKind) {
            let endI = i + 1;
            while (endI <= lastLine && !/^\s*```\s*$/.test(doc.line(endI).text)) endI += 1;
            if (endI <= lastLine) {
              addDiagramFence(builder, diagramKind, i, endI, {
                doc, cursorLine, cursorLineEnd, keepSource, opts,
                modes: state.field(fenceModeField, false) ?? new Map(),
                isSplitSide: state.field(splitSideField, false) ?? false,
              });
              i = endI + 1;
              continue;
            }
          }

          // v4.10 issue #163 — ```plantuml / ```puml fence (opt-in).
          const plantumlCfg = opts.getPlantuml?.();
          if (
            plantumlCfg?.enabled &&
            plantumlCfg.server &&
            /^\s*```\s*(plantuml|puml)\s*$/i.test(line.text)
          ) {
            let endI = i + 1;
            while (endI <= lastLine) {
              const next = doc.line(endI);
              if (/^\s*```\s*$/.test(next.text)) break;
              endI += 1;
            }
            if (endI <= lastLine) {
              const cursorInside = keepSource || (cursorLine >= i && cursorLine <= endI);
              const cursorInsideEnd = cursorLineEnd >= i && cursorLineEnd <= endI;
              if (!cursorInside && !cursorInsideEnd) {
                let body = '';
                for (let k = i + 1; k < endI; k++) {
                  body += (k > i + 1 ? '\n' : '') + doc.line(k).text;
                }
                const blockFrom = doc.line(i).from;
                const blockTo = doc.line(endI).to;
                builder.add(
                  blockFrom,
                  blockTo,
                  Decoration.replace({
                    widget: new PlantumlWidget(body, plantumlSvgUrl(plantumlCfg.server, body)),
                    block: true,
                  }),
                );
              }
              i = endI + 1;
              continue;
            }
          }

          // Table block — header + separator + ≥1 body row.
          if (isPipeRow(line.text) && i + 1 <= lastLine) {
            const sepLine = doc.line(i + 1);
            if (isSeparatorRow(sepLine.text) && i + 2 <= lastLine) {
              // Walk forward as long as we keep seeing pipe rows.
              let endI = i + 2;
              while (endI <= lastLine) {
                const next = doc.line(endI);
                if (!isPipeRow(next.text)) break;
                endI += 1;
              }
              const tableEnd = endI - 1; // last pipe row
              if (tableEnd >= i + 2) {
                const cursorInside =
                  keepSource ||
                  (cursorLine >= i && cursorLine <= tableEnd
                    ? true
                    : cursorLineEnd >= i && cursorLineEnd <= tableEnd);
                if (!cursorInside) {
                  const blockFrom = doc.line(i).from;
                  const blockTo = doc.line(tableEnd).to;
                  const source = doc.sliceString(blockFrom, blockTo);
                  builder.add(
                    blockFrom,
                    blockTo,
                    Decoration.replace({
                      widget: new TableWidget(source),
                      block: true,
                    }),
                  );
                }
                i = tableEnd + 1;
                continue;
              }
            }
          }

          // v4.5.5 — inline math `$…$` on an otherwise-plain line. Render each
          // span while the caret is off this line (same reveal model as the
          // block widgets above: move the caret onto the line to edit source).
          // Cheap pre-check: only the (rare) lines that actually contain a `$`
          // pay for the inline-math regex + code-span mask. Plain prose lines
          // — the overwhelming majority in a large doc — short-circuit here, so
          // this whole-doc pass doesn't get measurably slower (#5 perf).
          const inlineCursorHere = keepSource || (i >= cursorLine && i <= cursorLineEnd);
          if (!inlineCursorHere && line.text.indexOf('$') !== -1) {
            for (const span of inlineMathSpans(line.text)) {
              builder.add(
                line.from + span.start,
                line.from + span.end,
                Decoration.replace({ widget: new InlineMathWidget(span.tex) }),
              );
            }
          }

          i += 1;
        }

        return builder.finish();
}
