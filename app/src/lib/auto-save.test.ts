import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAutoSave, clampAutoSaveDelay, DEFAULT_AUTO_SAVE_DELAY_MS, MAX_AUTO_SAVE_DELAY_MS, MIN_AUTO_SAVE_DELAY_MS } from './auto-save.ts';

const dirty = { filePath: '/a/b.md', language: 'markdown', content: 'new', savedContent: 'old' };

test('delay falls back to the default for junk', () => {
  assert.equal(clampAutoSaveDelay(undefined), DEFAULT_AUTO_SAVE_DELAY_MS);
  assert.equal(clampAutoSaveDelay('5'), DEFAULT_AUTO_SAVE_DELAY_MS);
  assert.equal(clampAutoSaveDelay(Number.NaN), DEFAULT_AUTO_SAVE_DELAY_MS);
});

test('delay is clamped to range', () => {
  assert.equal(clampAutoSaveDelay(10), MIN_AUTO_SAVE_DELAY_MS);
  assert.equal(clampAutoSaveDelay(10 ** 9), MAX_AUTO_SAVE_DELAY_MS);
  assert.equal(clampAutoSaveDelay(2500), 2500);
});

test('saves a dirty file-backed tab', () => {
  assert.equal(canAutoSave(dirty, false), true);
});

test('skips clean, untitled, conflicted, diff and xmind tabs', () => {
  assert.equal(canAutoSave({ ...dirty, savedContent: 'new' }, false), false);
  assert.equal(canAutoSave({ ...dirty, filePath: null }, false), false);
  assert.equal(canAutoSave(dirty, true), false);
  assert.equal(canAutoSave({ ...dirty, language: 'git-diff' }, false), false);
  assert.equal(canAutoSave({ ...dirty, filePath: '/a/m.xmind' }, false), false);
});
