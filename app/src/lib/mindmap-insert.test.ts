import { test } from 'node:test';
import assert from 'node:assert/strict';
import { needsPasteDialog, normalizePasteMapSetting, resolveInsertTargetId } from './mindmap-insert.ts';

test('selected mode uses selection', () => assert.equal(resolveInsertTargetId('n1', 'root', 'selected'), 'n1'));
test('selected mode without selection falls back to root', () => assert.equal(resolveInsertTargetId(null, 'root', 'selected'), 'root'));
test('root mode ignores selection', () => assert.equal(resolveInsertTargetId('n1', 'root', 'root'), 'root'));

test('dialog only for whole-map paste with a selection and setting=ask', () => {
  assert.equal(needsPasteDialog('mmap', true, 'ask'), true);
  assert.equal(needsPasteDialog('mmap', false, 'ask'), false);
  assert.equal(needsPasteDialog('markdown', true, 'ask'), false);
  assert.equal(needsPasteDialog('mmap', true, 'root'), false);
});

test('normalizePasteMapSetting falls back to ask', () => {
  assert.equal(normalizePasteMapSetting('root'), 'root');
  assert.equal(normalizePasteMapSetting('bogus'), 'ask');
  assert.equal(normalizePasteMapSetting(undefined), 'ask');
});
