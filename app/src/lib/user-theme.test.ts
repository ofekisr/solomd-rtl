import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { harmonize, mergeKeeping, mix, normalizeUserThemes, THEME_TOKEN_KEYS, toHex6, userThemeCss } from './user-theme.ts';

const BASICS = {
  '--bg': '#ffffff', '--bg-elev': '#f0f0f0', '--text': '#000000',
  '--text-muted': '#666666', '--accent': '#0066cc', '--border': '#dddddd',
};

describe('toHex6', () => {
  it('expands short hex and converts rgb()', () => {
    assert.equal(toHex6('#AbC'), '#aabbcc');
    assert.equal(toHex6(' rgba(255, 0, 16, 0.5) '), '#ff0010');
  });
  it('falls back for values a colour input cannot hold', () => {
    assert.equal(toHex6('linear-gradient(red, blue)'), '#808080');
  });
});

describe('mix', () => {
  it('blends two colours by amount', () => {
    assert.equal(mix('#000000', '#ffffff', 0.5), '#808080');
  });
});

describe('harmonize', () => {
  it('fills every non-syntax token from the basics', () => {
    const out = harmonize(BASICS);
    assert.equal(out['--md-link'], '#0066cc');
    assert.equal(out['--bg-soft'], '#f0f0f0');
    assert.equal(out['--accent-fg'], '#ffffff');
  });
});

describe('hand-picked colours', () => {
  it('harmonize leaves kept tokens alone', () => {
    const out = harmonize({ ...BASICS, '--md-link': '#ff00ff' }, ['--md-link']);
    assert.equal(out['--md-link'], '#ff00ff');
    assert.equal(out['--md-list'], '#0066cc');
  });
  it('mergeKeeping overwrites everything except kept tokens', () => {
    const out = mergeKeeping({ '--bg': '#111111', '--text': '#222222' }, { '--bg': '#ffffff', '--text': '#000000' }, ['--text']);
    assert.deepEqual(out, { '--bg': '#ffffff', '--text': '#222222' });
  });
  it('normalizeUserThemes keeps only known edited keys', () => {
    const [ut] = normalizeUserThemes([{ id: 'a', name: 'A', light: {}, dark: {}, edited: { light: ['--bg', '--evil', 3], dark: 'x' } }]);
    assert.deepEqual(ut.edited, { light: ['--bg'], dark: [] });
  });
});

describe('userThemeCss', () => {
  it('keys each palette on its data-theme mode', () => {
    const css = userThemeCss({ id: 'a', name: 'X */ y', light: { '--bg': '#ffffff' }, dark: { '--bg': '#000000' }, edited: { light: [], dark: [] } });
    assert.ok(css.includes(':root[data-theme="light"] {\n  color-scheme: light;\n  --bg: #ffffff;'));
    assert.ok(css.includes(':root[data-theme="dark"] {\n  color-scheme: dark;\n  --bg: #000000;'));
    assert.ok(!css.includes('X */'));
  });
});

describe('normalizeUserThemes', () => {
  it('drops malformed themes and non-colour values', () => {
    const out = normalizeUserThemes([
      { id: 'ok', name: 'Ok', light: { '--bg': '#fff', '--evil': 'red', '--text': 'url(x)' }, dark: {} },
      { name: 'no id' },
      'junk',
    ]);
    assert.deepEqual(out, [{ id: 'ok', name: 'Ok', light: { '--bg': '#ffffff' }, dark: {}, edited: { light: [], dark: [] } }]);
  });
  it('covers the tokens the marketplace themes set', () => {
    for (const key of ['--danger', '--bg-soft', '--syn-comment', '--md-hr']) assert.ok(THEME_TOKEN_KEYS.includes(key), key);
  });
});
