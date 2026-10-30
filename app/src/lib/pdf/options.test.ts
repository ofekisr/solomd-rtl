import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  parsePdfFrontMatter,
  resolvePdfOptions,
  userTouchedPdfDefaults,
  buildPrintStyle,
  buildWindowsPrintFrameStyle,
  withPdfToc,
} from './options.ts';
import { defaultPdfDefaults } from '../../stores/settings.ts';

test('parsePdfFrontMatter reads block and inline forms', () => {
  const block = '---\ntitle: x\npdf:\n  pageSize: A5\n  margin: 15mm\n  font: "Fira Code"\n  fontSize: 12\n  footer: yes\n  toc: off\nother: 1\n---\nbody';
  assert.deepEqual(parsePdfFrontMatter(block), {
    pageSize: 'A5',
    margin: '15mm',
    fontFamily: 'Fira Code',
    fontSizePt: 12,
    footer: true,
    toc: false,
  });
  assert.deepEqual(parsePdfFrontMatter('---\npdf: { pageSize: Letter, margin_top: 1in }\n---\n'), {
    pageSize: 'Letter',
    marginTopMm: 25.4,
  });
  assert.deepEqual(parsePdfFrontMatter('no front matter'), {});
});

test('resolvePdfOptions: untouched returns null sentinels', () => {
  const r = resolvePdfOptions(defaultPdfDefaults(), 'hello', false);
  assert.equal(r.pageSizeMm, null);
  assert.equal(r.marginMm, null);
  assert.equal(r.pageSizeLabel, 'Default');
});

test('resolvePdfOptions: front matter wins over settings', () => {
  const s = defaultPdfDefaults();
  const r = resolvePdfOptions(s, '---\npdf:\n  pageSize: custom\n  pageWidth: 100\n  margin: Wide\n  marginLeft: 1cm\n  fontSize: 99\n---\n', false);
  assert.deepEqual(r.pageSizeMm, { width: 100, height: s.customHeightMm });
  assert.equal(r.pageSizeLabel, 'Custom');
  assert.deepEqual(r.marginMm, { top: 25, right: 25, bottom: 25, left: 10 });
  assert.equal(r.fontSizePt, 36);
  assert.equal(r.footer, s.footer);
});

test('resolvePdfOptions: settings custom page + margins', () => {
  const s = { ...defaultPdfDefaults(), pageSize: 'Custom', customWidthMm: 10, margin: 'Custom', customMarginTopMm: 200 };
  const r = resolvePdfOptions(s as never, '');
  assert.deepEqual(r.pageSizeMm, { width: 50, height: 297 });
  assert.equal(r.marginMm?.top, 100);
});

test('userTouchedPdfDefaults', () => {
  assert.equal(userTouchedPdfDefaults(defaultPdfDefaults()), false);
  assert.equal(userTouchedPdfDefaults({ ...defaultPdfDefaults(), fontSize: 14 }), true);
});

test('buildPrintStyle', () => {
  const s = defaultPdfDefaults();
  assert.equal(buildPrintStyle(resolvePdfOptions(s, '', false)), '');
  const css = buildPrintStyle({
    ...resolvePdfOptions(s, ''),
    fontFamily: 'My Font',
    codeTheme: 'dark',
    footer: true,
  });
  assert.match(css, /@page \{ size: 210mm 297mm; margin: 15mm 15mm 15mm 15mm; \}/);
  assert.match(css, /font-family: "My Font", "PingFang SC"/);
  assert.match(css, /pre, code \{ background: #1f1d1a !important/);
  assert.match(css, /counter\(page\)/);
});

test('buildWindowsPrintFrameStyle and withPdfToc', () => {
  const css = buildWindowsPrintFrameStyle(resolvePdfOptions(defaultPdfDefaults(), '', false));
  assert.match(css, /padding: 12mm 12mm 12mm 12mm !important;/);
  assert.equal(withPdfToc('# a'), '[TOC]\n\n# a');
  assert.equal(withPdfToc('x\n[toc]\ny'), 'x\n[toc]\ny');
});
