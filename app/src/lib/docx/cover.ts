import { AlignmentType, PageBreak, Paragraph, TextRun } from 'docx';
import type { DocxTemplate } from './template.ts';

/** Title page: title, then author and date if the document names them. Ends
 *  with a page break so the body starts on page two. */
export function buildCover(tpl: DocxTemplate): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({ text: '', spacing: { before: 2400 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: tpl.title || 'Untitled', bold: true, size: 56 })],
    }),
  ];
  // Empty fields are skipped rather than printed as blank lines — a cover with
  // a stray gap where the author should be looks like a bug.
  if (tpl.author) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: tpl.author, size: 28 })],
      }),
    );
  }
  if (tpl.date) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: tpl.date, size: 24 })],
      }),
    );
  }
  out.push(new Paragraph({ children: [new PageBreak()] }));
  return out;
}
