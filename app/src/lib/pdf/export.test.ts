import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildHtml2PdfOptions } from './export.ts';
import { resolvePdfOptions } from './options.ts';
import { defaultPdfDefaults } from '../../stores/settings.ts';

test('buildHtml2PdfOptions: legacy defaults without options', () => {
  const o = buildHtml2PdfOptions('My Doc');
  assert.deepEqual(o.margin, [10, 10, 12, 10]);
  assert.equal(o.filename, 'My Doc.pdf');
  assert.equal(o.jsPDF.format, 'a4');
  assert.equal(o.jsPDF.orientation, 'portrait');
  assert.equal(o.html2canvas.scale, 2);
  assert.equal(buildHtml2PdfOptions('').filename, 'document.pdf');
  assert.ok(o.pagebreak.avoid.includes('li'));
});

test('buildHtml2PdfOptions: resolved options', () => {
  const s = defaultPdfDefaults();
  const named = buildHtml2PdfOptions('t', resolvePdfOptions({ ...s, pageSize: 'Letter' } as never, ''));
  assert.equal(named.jsPDF.format, 'letter');
  assert.deepEqual(named.margin, [15, 15, 15, 15]);
  const custom = buildHtml2PdfOptions('t', resolvePdfOptions({ ...s, pageSize: 'Custom', customWidthMm: 300, customHeightMm: 200 } as never, ''));
  assert.deepEqual(custom.jsPDF.format, [300, 200]);
  assert.equal(custom.jsPDF.orientation, 'landscape');
});
