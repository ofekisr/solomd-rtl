/**
 * Convert markdown source to a DOCX Blob using the `docx` library.
 * Walks markdown-it tokens and emits Word paragraphs / runs.
 *
 * Supports: headings (h1-h6), paragraphs, bold, italic, inline code, links,
 * fenced code blocks, ordered/bullet lists, blockquotes, horizontal rules,
 * tables, and embedded images (local + remote).
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  PageBreak,
  TableOfContents,
  LineRuleType,
  type Table,
} from 'docx';
import { mermaidToPng } from '../diagram-export.ts';
import { md, extractImageRoot, preprocessMarkdown } from '../markdown/markdown.ts';
import {
  resolveDocxTemplate,
  renderHeaderText,
  type DocxPreset,
} from './template.ts';
import { buildRuns } from './runs.ts';
import { buildTable } from './table.ts';
import { buildCover } from './cover.ts';
import {
  clearImageCache,
  fetchImageBytes,
  resolveLocalImagePath,
  scaleDimensions,
} from './images.ts';
import {
  centeredImageParagraph,
  codeBlockParagraphs,
  imagePlaceholderParagraph,
} from './blocks.ts';
import type Token from 'markdown-it/lib/token.mjs';

type BlockChild = Paragraph | Table;


const HEADING_LEVELS: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4,
  h5: HeadingLevel.HEADING_5,
  h6: HeadingLevel.HEADING_6,
};

/** Heading paragraph spacing, tuned to visually match our HTML/PDF cascade. */
const HEADING_SPACING: Record<string, { before: number; after: number }> = {
  h1: { before: 360, after: 180 },
  h2: { before: 320, after: 160 },
  h3: { before: 280, after: 140 },
  h4: { before: 240, after: 120 },
  h5: { before: 200, after: 100 },
  h6: { before: 200, after: 100 },
};

/**
 * Find the matching close token for `openType` starting at index `start`
 * (which should point AT the open token). Returns the index of the close.
 * Handles nested open/close pairs of the same type.
 */
function findMatchingClose(tokens: Token[], start: number, openType: string, closeType: string): number {
  let depth = 0;
  for (let j = start; j < tokens.length; j++) {
    if (tokens[j].type === openType) depth++;
    else if (tokens[j].type === closeType) {
      depth--;
      if (depth === 0) return j;
    }
  }
  return tokens.length - 1;
}

async function buildBody(tokens: Token[], imageRoot: string | null, filePath?: string): Promise<BlockChild[]> {
  const out: BlockChild[] = [];
  let i = 0;
  const listStack: { type: 'bullet' | 'ordered'; index: number }[] = [];

  while (i < tokens.length) {
    const tok = tokens[i];
    switch (tok.type) {
      case 'heading_open': {
        const level = tok.tag;
        const inline = tokens[i + 1];
        i += 3;
        out.push(
          new Paragraph({
            heading: HEADING_LEVELS[level],
            children: buildRuns(inline),
            spacing: HEADING_SPACING[level] ?? { before: 240, after: 120 },
            keepNext: true,
          })
        );
        break;
      }
      case 'paragraph_open': {
        const inline = tokens[i + 1];
        i += 3;
        const isInList = listStack.length > 0;

        // Check if this paragraph contains a standalone image (image-only paragraph)
        if (inline && isImageOnlyParagraph(inline)) {
          const imgTok = inline.children!.find(c => c.type === 'image')!;
          const src = imgTok.attrGet('src') || '';
          const alt = imgTok.content || imgTok.attrGet('alt') || '';
          const absPath = resolveLocalImagePath(src, imageRoot, filePath);

          if (absPath) {
            const img = await fetchImageBytes(absPath);
            if (img) {
              const dim = scaleDimensions(img.width, img.height);
              out.push(centeredImageParagraph(img.type, img.data, dim, alt));
              break;
            }
          }

          // Fallback: placeholder for remote or unreadable images
          out.push(imagePlaceholderParagraph(src, alt));
          break;
        }

        out.push(
          new Paragraph({
            children: buildRuns(inline),
            spacing: isInList ? { before: 60, after: 60 } : { before: 120, after: 120 },
            ...(isInList && {
              numbering:
                listStack[listStack.length - 1].type === 'ordered'
                  ? { reference: 'ordered-list', level: Math.min(listStack.length - 1, 8) }
                  : undefined,
              bullet:
                listStack[listStack.length - 1].type === 'bullet'
                  ? { level: Math.min(listStack.length - 1, 8) }
                  : undefined,
            }),
          })
        );
        break;
      }
      case 'fence':
      case 'code_block': {
        // #256 — a mermaid fence becomes the diagram, as a PNG (Word has no
        // reliable SVG support). If it cannot be rendered the source falls
        // through to the ordinary code block below.
        if (tok.type === 'fence' && (tok.info || '').trim().split(/\s+/)[0].toLowerCase() === 'mermaid') {
          const png = await mermaidToPng(tok.content || '');
          if (png) {
            const dim = scaleDimensions(png.width, png.height);
            out.push(centeredImageParagraph('png', png.data, dim, 'Mermaid diagram'));
            i += 1;
            break;
          }
        }
        out.push(...codeBlockParagraphs(tok.content || ''));
        i += 1;
        break;
      }
      case 'hr':
        out.push(
          new Paragraph({
            text: '',
            spacing: { before: 240, after: 240 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
          })
        );
        i += 1;
        break;
      case 'blockquote_open': {
        const end = findMatchingClose(tokens, i, 'blockquote_open', 'blockquote_close');
        const inner = tokens.slice(i + 1, end);
        // Build runs directly from each inner paragraph's inline tokens
        // instead of round-tripping through buildBody → Paragraph and
        // trying to re-extract `.options.children`. The `docx` library's
        // Paragraph instances don't expose constructor children publicly,
        // so the old extraction returned [] and produced empty
        // bordered paragraphs (issue: blockquotes vanished on docx export).
        let j = 0;
        while (j < inner.length) {
          const t = inner[j];
          if (t.type === 'paragraph_open') {
            const inlineTok = inner[j + 1];
            const runs = inlineTok && inlineTok.type === 'inline'
              ? buildRuns(inlineTok)
              : [];
            out.push(
              new Paragraph({
                children: runs.length > 0 ? (runs as TextRun[]) : [new TextRun({ text: ' ' })],
                alignment: AlignmentType.LEFT,
                indent: { left: 360 },
                spacing: { before: 80, after: 80 },
                border: {
                  left: { style: BorderStyle.SINGLE, size: 18, color: 'FF9F40', space: 8 },
                },
              })
            );
            // Skip paragraph_open, inline, paragraph_close
            j += 3;
          } else {
            // Non-paragraph children (nested lists, fenced code, headings,
            // tables) — recurse so they keep their structure. They render
            // without the blockquote indent, which matches how most docx
            // renderers handle nested non-paragraph blockquoted content.
            const sliceEnd = (() => {
              if (t.type.endsWith('_open')) {
                const closeType = t.type.replace(/_open$/, '_close');
                return findMatchingClose(inner, j, t.type, closeType) + 1;
              }
              return j + 1;
            })();
            const nestedBlocks = await buildBody(inner.slice(j, sliceEnd), imageRoot, filePath);
            for (const b of nestedBlocks) out.push(b);
            j = sliceEnd;
          }
        }
        i = end + 1;
        break;
      }
      case 'table_open': {
        const end = findMatchingClose(tokens, i, 'table_open', 'table_close');
        const table = buildTable(tokens.slice(i + 1, end));
        if (table) out.push(table);
        out.push(new Paragraph({ text: '', spacing: { before: 0, after: 120 } }));
        i = end + 1;
        break;
      }
      case 'bullet_list_open':
        listStack.push({ type: 'bullet', index: 0 });
        i += 1;
        break;
      case 'ordered_list_open':
        listStack.push({ type: 'ordered', index: 0 });
        i += 1;
        break;
      case 'bullet_list_close':
      case 'ordered_list_close':
        listStack.pop();
        i += 1;
        break;
      case 'list_item_open':
      case 'list_item_close':
        i += 1;
        break;
      default:
        i += 1;
    }
  }
  return out;
}

/** Check if an inline token's children consist of only a single image (possibly wrapped in a link). */
function isImageOnlyParagraph(inline: Token): boolean {
  if (!inline.children) return false;
  const nonWhitespace = inline.children.filter(
    c => !(c.type === 'text' && !c.content.trim()) && c.type !== 'softbreak'
  );
  if (nonWhitespace.length === 1 && nonWhitespace[0].type === 'image') return true;
  // Link wrapping an image: link_open → image → link_close
  if (nonWhitespace.length === 3
    && nonWhitespace[0].type === 'link_open'
    && nonWhitespace[1].type === 'image'
    && nonWhitespace[2].type === 'link_close') return true;
  return false;
}


export async function markdownToDocxBlob(
  source: string,
  _title = 'Document',
  filePath?: string,
  preset: DocxPreset = 'plain',
  /** Heading printed above the table of contents. Passed in because this
   *  module has no access to the i18n store. */
  contentsLabel = 'Contents',
): Promise<Blob> {
  clearImageCache();
  // Apply the same leniency preprocessors the HTML render path uses (malformed
  // table delimiters, list re-indent, inline-HTML blocks) so DOCX export
  // doesn't silently drop tables/lists the preview shows correctly.
  const tokens = md.parse(preprocessMarkdown(source ?? ''), {});
  const imageRoot = extractImageRoot(source || '');
  const blocks = await buildBody(tokens, imageRoot, filePath);
  if (blocks.length === 0) blocks.push(new Paragraph({ text: '' }));

  const tpl = resolveDocxTemplate(preset, source ?? '', _title);
  const headerText = renderHeaderText(tpl);

  const front: BlockChild[] = [];
  if (tpl.cover) front.push(...buildCover(tpl));
  if (tpl.toc) {
    // A Word TOC is a field, not text: Word fills it in and offers to update
    // it on open. Generating a static list instead would go stale the moment
    // anyone edited the document.
    front.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: contentsLabel })],
      }),
      new TableOfContents(contentsLabel, { hyperlink: true, headingStyleRange: '1-3' }),
      new Paragraph({ children: [new PageBreak()] }),
    );
  }

  const doc = new Document({
    creator: 'SoloMD',
    title: tpl.title || _title,
    description: 'Exported from SoloMD',
    styles: {
      default: {
        document: {
          run: {
            size: tpl.fontSizePt * 2, // docx counts half-points
            ...(tpl.fontFamily ? { font: tpl.fontFamily } : {}),
          },
          paragraph: {
            spacing: {
              after: Math.round(tpl.paragraphSpacingPt * 20), // twips
              line: Math.round(tpl.lineSpacing * 240),
              lineRule: LineRuleType.AUTO,
            },
          },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: 'ordered-list',
          levels: [
            { level: 0, format: 'decimal', text: '%1.', alignment: AlignmentType.START },
            { level: 1, format: 'lowerLetter', text: '%2.', alignment: AlignmentType.START },
            { level: 2, format: 'lowerRoman', text: '%3.', alignment: AlignmentType.START },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          // With a cover page, `titlePage` gives page one its own (empty)
          // header and footer — a running header across the title page is
          // the giveaway that a template was bolted on.
          titlePage: tpl.cover,
        },
        headers: headerText
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: headerText, size: 18, color: '888888' })],
                  }),
                ],
              }),
              first: new Header({ children: [new Paragraph({ text: '' })] }),
            }
          : undefined,
        footers: tpl.pageNumbers
          ? {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '888888' }),
                    ],
                  }),
                ],
              }),
              first: new Footer({ children: [new Paragraph({ text: '' })] }),
            }
          : undefined,
        children: [...front, ...blocks],
      },
    ],
  });

  return Packer.toBlob(doc);
}
