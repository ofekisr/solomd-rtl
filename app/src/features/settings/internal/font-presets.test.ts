import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CUSTOM_PDF_FONT_VALUE, FONT_FAMILIES, isPresetFont, pdfFontSelectValue } from './font-presets.ts';

test('preset list keeps its 15 entries and order', () => {
  assert.equal(FONT_FAMILIES.length, 15);
  assert.equal(FONT_FAMILIES[0].value, 'JetBrains Mono');
  assert.equal(FONT_FAMILIES[14].value, 'TsangerJinKai03 W04');
});

test('isPresetFont matches values, not labels', () => {
  assert.equal(isPresetFont('Georgia'), true);
  assert.equal(isPresetFont('Source Han Sans SC'), true);
  assert.equal(isPresetFont('Source Han Sans'), false);
  assert.equal(isPresetFont(''), false);
});

test('pdf font select: preset passes through, empty means inherit, other is custom', () => {
  assert.equal(pdfFontSelectValue('Menlo'), 'Menlo');
  assert.equal(pdfFontSelectValue(''), '');
  assert.equal(pdfFontSelectValue('Comic Sans'), CUSTOM_PDF_FONT_VALUE);
});
