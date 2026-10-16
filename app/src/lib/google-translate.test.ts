import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleTranslateUrl, translateTargetLanguage } from './google-translate.ts';

test('builds an auto-detect URL with the text encoded', () => {
  const url = new URL(googleTranslateUrl('  שלום & hi  ', 'en')!);
  assert.equal(url.origin, 'https://translate.google.com');
  assert.equal(url.searchParams.get('sl'), 'auto');
  assert.equal(url.searchParams.get('tl'), 'en');
  assert.equal(url.searchParams.get('text'), 'שלום & hi');
});

test('blank selection yields no URL', () => {
  assert.equal(googleTranslateUrl(' \n ', 'en'), null);
});

test('long selections are capped', () => {
  const url = new URL(googleTranslateUrl('a'.repeat(9000), 'en')!);
  assert.equal(url.searchParams.get('text')!.length, 5000);
});

test('target language comes from the locale primary subtag', () => {
  assert.equal(translateTargetLanguage('he-IL'), 'he');
  assert.equal(translateTargetLanguage('pt_BR'), 'pt');
  assert.equal(translateTargetLanguage(undefined), 'en');
  assert.equal(translateTargetLanguage('*'), 'en');
});
