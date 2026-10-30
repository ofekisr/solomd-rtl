import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAutomatedBrowser } from './dev-seed.ts';

test('a WebDriver-controlled browser (Playwright) is automated, so the dev seed is skipped', () => {
  assert.equal(isAutomatedBrowser({ webdriver: true }), true);
});

test('a normal browser is not automated', () => {
  assert.equal(isAutomatedBrowser({ webdriver: false }), false);
  assert.equal(isAutomatedBrowser({}), false);
  assert.equal(isAutomatedBrowser(undefined), false);
});
