import assert from 'node:assert/strict';
import { test } from 'node:test';
import { siblingPath, convertedMarkdownPath, normalizeConvertConflictSetting, settingAfterAnswer } from './convert-conflict.ts';

test('converted path is the sibling .md', () => {
  assert.equal(convertedMarkdownPath('/v/docs/ex.pdf'), '/v/docs/ex.md');
  assert.equal(convertedMarkdownPath('C:\\v\\ex.v2.docx'), 'C:\\v\\ex.v2.md');
  assert.equal(convertedMarkdownPath('/v/.hidden'), '/v/.hidden.md');
});

test('unknown setting falls back to ask', () => {
  assert.equal(normalizeConvertConflictSetting('nope'), 'ask');
  assert.equal(normalizeConvertConflictSetting('keep'), 'keep');
});

test('remembered answers stick, cancel never does', () => {
  assert.equal(settingAfterAnswer('replace', true, 'ask'), 'replace');
  assert.equal(settingAfterAnswer('replace', false, 'ask'), 'ask');
  assert.equal(settingAfterAnswer('cancel', true, 'ask'), 'ask');
});

test('sibling path keeps the folder', () => {
  assert.equal(siblingPath('/v/map.mmap', 'map-outline.md'), '/v/map-outline.md');
  assert.equal(siblingPath('C:\\v\\a.md', 'a.mmap'), 'C:\\v\\a.mmap');
});
