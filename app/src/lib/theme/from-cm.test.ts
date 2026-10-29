// app/src/lib/theme/from-cm.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cmToTheme, type ExtractedCmTheme } from './from-cm.ts';
import { parseTheme } from './schema.ts';

const tag = (color: string, italic = false) => ({ color, italic, bold: false });
const dracula: ExtractedCmTheme = {
  id: 'cm-dracula', name: 'Dracula',
  chrome: {
    background: '#282a36', foreground: '#f8f8f2', gutterBg: '#282a36', gutterFg: '#6d8a88', activeLine: '#44475a',
    selection: '#44475a', cursor: '#f8f8f0', bracket: '#44475a', search: '#ffb86c', searchActive: '#ff79c6',
  },
  tags: {
    keyword: tag('#ff79c6'), string: tag('#f1fa8c'), number: tag('#bd93f9'), comment: tag('#6272a4', true),
    function: tag('#50fa7b'), variable: tag('#f8f8f2'), type: tag('#8be9fd'), property: tag('#66d9ef'),
    operator: tag('#ff79c6'), punctuation: tag('#f8f8f2'), tag: tag('#ff79c6'), attribute: tag('#50fa7b'),
    regexp: tag('#f1fa8c'), constant: tag('#bd93f9'), invalid: tag('#ff5555'), heading: tag('#bd93f9'),
    link: tag('#8be9fd'), emphasis: tag('#f1fa8c', true), strong: tag('#ffb86c'), quote: tag('#6272a4'),
  },
};

test('produces one valid dark catalog variant', () => {
  const theme = cmToTheme(dracula);
  assert.equal(parseTheme(theme).ok, true);
  assert.deepEqual(Object.keys(theme.variants), ['dark']);
  assert.equal(theme.source, 'catalog');
});

test('derives app colours from the editor', () => {
  const v = cmToTheme(dracula).variants.dark;
  assert.equal(v.app.colors.bg, '#282a36');
  assert.equal(v.app.colors.text, '#f8f8f2');
});

test('a near-grey cursor falls back to the function colour for accent', () => {
  assert.equal(cmToTheme(dracula).variants.dark.app.colors.accent, '#50fa7b');
});

test('a coloured cursor becomes the accent', () => {
  const x = structuredClone(dracula);
  x.chrome.cursor = '#ff0066';
  assert.equal(cmToTheme(x).variants.dark.app.colors.accent, '#ff0066');
});

test('italic comments carry over as a style prop', () => {
  assert.deepEqual(cmToTheme(dracula).variants.dark.code?.style?.comment, { italic: true });
});

test('markdown headings and links come from heading and link tags', () => {
  const md = cmToTheme(dracula).variants.dark.markdown?.colors;
  assert.equal(md?.h1, '#bd93f9');
  assert.equal(md?.link, '#8be9fd');
});

test('rgb() chrome from the extractor yields a light-mode theme', () => {
  const x = structuredClone(dracula);
  x.chrome.background = 'rgb(255, 255, 255)';
  x.chrome.foreground = 'rgb(36, 41, 47)';
  x.chrome.cursor = 'rgb(9, 105, 218)';
  const theme = cmToTheme(x);
  assert.deepEqual(Object.keys(theme.variants), ['light']);
  assert.equal(theme.variants.light.mode, 'light');
  assert.equal(parseTheme(theme).ok, true);
});
