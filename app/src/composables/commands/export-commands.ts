import type { Command, CommandCtx } from './command-types.ts';

export function exportCommands(ctx: CommandCtx): Command[] {
  const { exporter, pandoc, kb } = ctx;
  return [
    { id: 'export.html', title: 'Export to HTML…', run: () => exporter.exportHtml() },
    { id: 'export.docx', title: 'Export to Word (DOCX)…', run: () => exporter.exportDocx() },
    // Gitee IK8QJQ — the raster/text distinction decides whether the output
    // is searchable, so it belongs in the palette too, not just the toolbar.
    { id: 'export.pdfPrint', title: 'Export to PDF (text)…', hint: 'real selectable text, via system print', shortcut: kb('export.pdfPrint'), run: () => exporter.exportPdfPrint() },
    { id: 'export.pdf', title: 'Export to PDF (image)…', hint: 'rasterised, text not selectable', run: () => exporter.exportPdf() },
    { id: 'export.image', title: 'Export to Image (PNG)…', run: () => exporter.exportImage() },
    { id: 'export.epub', title: 'Export to EPUB…', hint: 'via Pandoc', run: () => pandoc.exportTo('epub') },
    { id: 'export.odt', title: 'Export to ODT…', hint: 'via Pandoc', run: () => pandoc.exportTo('odt') },
    { id: 'export.latex', title: 'Export to LaTeX…', hint: 'via Pandoc', run: () => pandoc.exportTo('latex') },
    { id: 'export.rtf', title: 'Export to RTF…', hint: 'via Pandoc', run: () => pandoc.exportTo('rtf') },
    { id: 'export.pandocCustom', title: 'Export via Pandoc Template…', run: () => pandoc.exportTo('custom') },
    { id: 'export.copyHtml', title: 'Copy as HTML', shortcut: kb('export.copyHtml'), run: () => exporter.copyAsHtml() },
    { id: 'export.copyPlain', title: 'Copy as Plain Text', run: () => exporter.copyAsPlainText() },
    { id: 'export.copyMd', title: 'Copy as Markdown', shortcut: kb('export.copyMd'), run: () => exporter.copyAsMarkdown() },
    { id: 'export.copyImage', title: 'Copy as Image (PNG)', run: () => exporter.copyAsImage() },
  ];
}
