import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_PAGE_KEYS, categoryOf, crumbsOf, defaultPage, isMultiPage, pageVisibilityCss, parsePageKey } from './settings-nav.ts';

test('a bare category resolves to its first page, including keys', () => {
  assert.equal(parsePageKey('keys'), 'keys/main');
  assert.equal(parsePageKey('basics'), 'basics/language');
  assert.equal(parsePageKey('theme'), 'theme/main');
});

test('a full page key passes through, an unknown one is rejected', () => {
  assert.equal(parsePageKey('writing/image-upload'), 'writing/image-upload');
  assert.equal(parsePageKey('writing/nope'), null);
  assert.equal(parsePageKey('nope'), null);
  assert.equal(parsePageKey(null), null);
});

test('page keys are unique and know their category', () => {
  assert.equal(new Set(ALL_PAGE_KEYS).size, ALL_PAGE_KEYS.length);
  assert.equal(categoryOf('advanced/files'), 'advanced');
  assert.equal(defaultPage('advanced'), 'advanced/startup');
});

test('single-page categories show no page crumb', () => {
  assert.equal(isMultiPage('keys'), false);
  assert.deepEqual(crumbsOf('keys/main'), { categoryLabelKey: 'settings.catKeys', pageLabelKey: null });
  assert.deepEqual(crumbsOf('writing/focus'), { categoryLabelKey: 'settings.catWriting', pageLabelKey: 'settings.pageFocus' });
});

test('visibility css only ever names a known page', () => {
  assert.match(pageVisibilityCss('basics/fonts'), /\[data-page="basics\/fonts"\]/);
  assert.equal(pageVisibilityCss('x"]{}*{display:none'), '');
  assert.equal(pageVisibilityCss(null), '');
});
