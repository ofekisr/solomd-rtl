import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  contrastRatio, fitBackdrops, flashColorFor, harmonize, mergeKeeping, mix, normalizeUserThemes,
  THEME_TOKEN_GROUPS, THEME_TOKEN_KEYS, THEME_TOKEN_PAIRS, toHex6, userThemeCss,
} from './user-theme.ts';
import type { UserTheme } from './user-theme.ts';

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
    const css = userThemeCss({ id: 'a', name: 'X */ y', light: { '--bg': '#ffffff' }, dark: { '--bg': '#000000' }, edited: { light: [], dark: [] }, radius: 1, gradient: { light: 'inherit', dark: 'inherit' } });
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
    assert.deepEqual(out, [{ id: 'ok', name: 'Ok', light: { '--bg': '#ffffff' }, dark: {}, edited: { light: [], dark: [] }, radius: 1, gradient: { light: 'inherit', dark: 'inherit' } }]);
  });
  it('covers the tokens the marketplace themes set', () => {
    for (const key of ['--danger', '--bg-soft', '--syn-comment', '--md-hr']) assert.ok(THEME_TOKEN_KEYS.includes(key), key);
  });
});

describe('contrastRatio', () => {
  it('spans 1 to 21 and ignores order', () => {
    assert.equal(Math.round(contrastRatio('#000000', '#ffffff')), 21);
    assert.equal(contrastRatio('#123456', '#123456'), 1);
    assert.equal(contrastRatio('#ffffff', '#336699'), contrastRatio('#336699', '#ffffff'));
  });
});

describe('flashColorFor', () => {
  it('picks the loud colour further from the token', () => {
    assert.notEqual(flashColorFor('#ff00c8'), '#ff00c8');
    assert.notEqual(flashColorFor('#00e5ff'), '#00e5ff');
  });
});

describe('userThemeCss layering', () => {
  it('outranks a custom CSS theme keyed on :root', () => {
    const css = userThemeCss({ id: 'a', name: 'A', light: { '--bg': '#ffffff' }, dark: {}, edited: { light: [], dark: [] }, radius: 1, gradient: { light: 'inherit', dark: 'inherit' } });
    assert.match(css, /html:root\[data-theme="light"\]/);
  });
});

describe('radius', () => {
  const theme = { id: 'a', name: 'A', light: {}, dark: {}, edited: { light: [], dark: [] }, gradient: { light: 'inherit', dark: 'inherit' } };
  it('writes corner sizes only when changed from the default', () => {
    assert.ok(!userThemeCss({ ...theme, radius: 1 }).includes('--r-sm'));
    assert.match(userThemeCss({ ...theme, radius: 0 }), /--r-sm: 0px;/);
    assert.match(userThemeCss({ ...theme, radius: 2 }), /--r-lg: 24px;/);
  });
  it('clamps stored values', () => {
    const [hi, bad] = normalizeUserThemes([{ ...theme, radius: 9 }, { ...theme, id: 'b', radius: 'x' }]);
    assert.equal(hi.radius, 2);
    assert.equal(bad.radius, 1);
  });
});

describe('THEME_TOKEN_PAIRS', () => {
  it('pairs two tokens of the same group', () => {
    for (const { fg, bg } of THEME_TOKEN_PAIRS) {
      const group = THEME_TOKEN_GROUPS.find((g) => g.tokens.some((tk) => tk.key === fg));
      assert.ok(group?.tokens.some((tk) => tk.key === bg), `${fg} / ${bg}`);
    }
  });
});

describe('backdrop', () => {
  const theme = (gradient: UserTheme['gradient']): UserTheme => ({
    id: 'a', name: 'A', light: {}, dark: {}, edited: { light: [], dark: [] }, radius: 1, gradient,
  });
  it('leaves a custom CSS theme\'s background alone when kept', () => {
    assert.ok(!userThemeCss(theme({ light: 'inherit', dark: 'inherit' })).includes('--bg-grad'));
  });
  it('clears an inherited gradient for a plain mode', () => {
    assert.match(userThemeCss(theme({ light: null, dark: 'inherit' })), /\[data-theme="light"\] \{[^}]*--bg-grad: none;/);
  });
  it('paints a gradient and lets it show through the panels', () => {
    const css = userThemeCss(theme({ light: null, dark: { from: '#000000', to: '#112233', angle: 90 } }));
    assert.match(css, /--bg-grad: linear-gradient\(90deg, #000000, #112233\);/);
    assert.match(css, /html:root\[data-theme="dark"\] body \{\n {2}background-image: var\(--bg-grad\);/);
    assert.ok(!css.includes('[data-theme="light"] body'));
  });
  it('keeps the background of themes saved before backdrops existed', () => {
    const [t] = normalizeUserThemes([{ id: 'x', name: 'X', light: {}, dark: {} }]);
    assert.deepEqual(t.gradient, { light: 'inherit', dark: 'inherit' });
  });
  it('drops malformed gradients to a plain background', () => {
    const [t] = normalizeUserThemes([{ id: 'x', name: 'X', gradient: { light: { from: 'red', to: '#000' }, dark: 5 } }]);
    assert.deepEqual(t.gradient, { light: null, dark: null });
  });
});

describe('fitBackdrops', () => {
  const theme: UserTheme = {
    id: 'a', name: 'A', light: { '--bg': '#ffffff' }, dark: { '--bg': '#101010' },
    edited: { light: [], dark: [] }, radius: 1, gradient: { light: 'inherit', dark: 'inherit' },
  };
  it('keeps a dark CSS background only for the dark half', () => {
    assert.deepEqual(fitBackdrops(theme, () => false).gradient, { light: null, dark: 'inherit' });
  });
  it('leaves everything alone with no CSS theme loaded', () => {
    assert.deepEqual(fitBackdrops(theme, () => null).gradient, { light: 'inherit', dark: 'inherit' });
  });
  it('never touches a gradient of the user\'s own', () => {
    const g = { from: '#ffffff', to: '#eeeeee', angle: 10 };
    assert.deepEqual(fitBackdrops({ ...theme, gradient: { light: g, dark: null } }, () => false).gradient, { light: g, dark: null });
  });
});
