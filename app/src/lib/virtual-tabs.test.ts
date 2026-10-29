import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isVirtualLanguage } from './virtual-tabs.ts';

test('git-diff and theme-studio tabs have no file behind them', () => {
  assert.equal(isVirtualLanguage('git-diff'), true);
  assert.equal(isVirtualLanguage('theme-studio'), true);
});

test('document languages are real files', () => {
  assert.equal(isVirtualLanguage('markdown'), false);
  assert.equal(isVirtualLanguage('mindmap'), false);
  assert.equal(isVirtualLanguage(undefined), false);
});
