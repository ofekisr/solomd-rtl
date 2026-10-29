import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cssImportIdFor, fileStem, marketplaceIdFor, marketplaceThemeId } from './ids.ts';
import { MAX_ID_LENGTH } from './tokens.ts';

test('fileStem drops directories and the .css extension', () => {
  assert.equal(fileStem('C:\\t\\Pure Black.CSS'), 'Pure Black');
  assert.equal(fileStem('/a/b/dracula.css'), 'dracula');
  assert.equal(fileStem('plain'), 'plain');
});

test('marketplace id from a manifest id matches the id migration derives from <id>.css', () => {
  for (const id of ['Dark_Pro', 'Aurora', 'x_y-Z']) {
    assert.equal(marketplaceThemeId(id), marketplaceIdFor(`/themes/${id}.css`));
  }
});

test('a 64-char manifest id stays within the id limit', () => {
  assert.ok(marketplaceThemeId('a'.repeat(MAX_ID_LENGTH)).length <= MAX_ID_LENGTH);
});

test('css file imports use their own namespace', () => {
  assert.equal(cssImportIdFor('/x/dracula.css'), 'css-dracula');
  assert.notEqual(cssImportIdFor('/x/dracula.css'), marketplaceIdFor('/x/dracula.css'));
  assert.ok(cssImportIdFor(`/x/${'b'.repeat(100)}.css`).length <= MAX_ID_LENGTH);
});
