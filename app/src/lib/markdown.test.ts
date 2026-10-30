import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  md,
  preprocessMarkdown,
  extractOutline,
  extractImageRoot,
  setMarkdownAutoNumberHeadings,
  setMarkdownSmartQuotes,
  setMarkdownHardBreaks,
} from './markdown.ts';

const GOLDEN = new URL('./markdown.golden.json', import.meta.url);

const CORPUS: Record<string, string> = {
  wikilink: 'See [[Note]] and [[Note#Head|alias]] and [[bad\nnest]]',
  spacedImage: '![a](D:/Program Files/a.png) and ![](x y.txt)',
  fence: '```js\nconst a = 1;\n// c\n```\n\n```mermaid\ngraph TD\n```\n\n```terminal Title\n$ ls\n```',
  multilineSpan: '```js\n/* a\n\nb */\nx\n```',
  math: '$$\nx^2\n$$\n\ninline $a$ and \\(b\\)',
  toc: '[TOC]\n\n# One\n\n## Two `x`\n\n# One\n\n[toc]',
  tocEmpty: '[TOC]\n\ntext',
  htmlBlock: '<div>\n<img src="a.png">\n</div>\n\ntext',
  shortCells: '| a | b |\n|---|---|\n| short | a very long cell that goes on and on and on |\n| 中文 | **x** |',
  tasks: '- [ ] one\n- [x] two\n  - [ ] nested\n\n1. [X] ord',
  callouts: '> [!NOTE]\n> body\n\n> [!TIP] inline\n\n> [!BOGUS]\n> x',
  rtl: 'שלום עולם\n\n- פריט\n\n> ציטוט\n\n```\ncode\n```\n\n    indented',
  frontMatter: '---\ntitle: T\ntags: [a]\n---\n\n# H',
  unwrapHtml: 'a\n    <table><tr><td>x</td></tr></table>\nb\n<div>q</div>text',
  badTable: '| a | b |\n| - | :-: |\n| 1 | 2 |\n\n| a | b\n|--|--\n| 1 | 2',
  listIndent: '- a\n\t- b\n\t\t- c\n\n1. x\n   - y\n  text',
  equations: '$$\na = b \\label{eq:1}\n$$\n\nsee \\eqref{eq:1}',
  cjk: '**限制：**硬链接 and **limit:**hard',
  typographer: '"quoted" it\'s (c) --- ...',
};

function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  setMarkdownAutoNumberHeadings(false);
  for (const [k, v] of Object.entries(CORPUS)) {
    out[`${k}:pre`] = preprocessMarkdown(v);
    out[`${k}:html`] = md.render(preprocessMarkdown(v), {});
    out[`${k}:outline`] = extractOutline(v);
  }
  setMarkdownAutoNumberHeadings(true);
  out['numbered'] = preprocessMarkdown('6.2 Title\n6.2.1 Sub\n3.14 is pi.\n```\n1.2 x\n```\n6 key');
  setMarkdownAutoNumberHeadings(false);
  setMarkdownSmartQuotes(true);
  out['smart'] = md.render('"q" it\'s');
  setMarkdownSmartQuotes(false);
  out['notSmart'] = md.render('"q" it\'s');
  setMarkdownHardBreaks(false);
  out['soft'] = md.render('a\nb');
  setMarkdownHardBreaks(true);
  out['hard'] = md.render('a\nb');
  out['imageRoot'] = [
    extractImageRoot('---\nimageRoot: "./img"\n---\nx'),
    extractImageRoot('---\ntypora-root-url: /a\n---'),
    extractImageRoot('no fm'),
  ];
  return out;
}

test('markdown render/preprocess matches golden snapshot', () => {
  const actual = JSON.parse(JSON.stringify(snapshot()));
  if (!existsSync(GOLDEN)) writeFileSync(GOLDEN, JSON.stringify(actual, null, 2));
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(actual, golden);
});
