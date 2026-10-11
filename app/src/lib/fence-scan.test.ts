import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scanFencedBlocks } from './fence-scan.ts';

test('finds backtick and tilde fences in order with info strings', () => {
  const src = 'a\n```mindmap\n- R\n```\n~~~js x\ncode\n~~~\n';
  const blocks = scanFencedBlocks(src);
  assert.deepEqual(blocks.map((b) => b.info), ['mindmap', 'js x']);
  assert.equal(blocks[0].body, '- R');
});

test('offsets slice the source exactly', () => {
  const src = 'x\n```mindmap\n- R\n  - A\n```\ny';
  const [b] = scanFencedBlocks(src);
  assert.equal(src.slice(b.from, b.to), '```mindmap\n- R\n  - A\n```');
  assert.equal(src.slice(b.bodyFrom, b.bodyTo), '- R\n  - A\n');
});

test('closing run must be the same char and at least as long', () => {
  const src = '````mindmap\n```\n- R\n````\n';
  const [b] = scanFencedBlocks(src);
  assert.equal(b.body, '```\n- R');
});

test('indented fence body is dedented by the opening indent', () => {
  const src = '  ```mindmap\n  - R\n    - A\n  ```\n';
  const [b] = scanFencedBlocks(src);
  assert.equal(b.indent, '  ');
  assert.equal(b.body, '- R\n  - A');
});

test('empty body has bodyFrom === bodyTo', () => {
  const [b] = scanFencedBlocks('```mindmap\n```\n');
  assert.equal(b.body, '');
  assert.equal(b.bodyFrom, b.bodyTo);
});

test('unclosed fence is not returned', () => {
  assert.deepEqual(scanFencedBlocks('```mindmap\n- R\n'), []);
});

test('backtick info containing a backtick is not a fence', () => {
  assert.deepEqual(scanFencedBlocks('```a`b\nx\n```\n').length, 0);
});

test('line is the 0-based line of the opening fence', () => {
  const blocks = scanFencedBlocks('# T\n\n```mindmap\n- R\n```\n\n~~~js\nx\n~~~\n');
  assert.deepEqual(blocks.map((b) => b.line), [2, 6]);
});

test('a 4-space-indented line does not open a fence', () => {
  assert.deepEqual(scanFencedBlocks('    ```mindmap\n    - R\n    ```\n'), []);
});

test('blockquote fences are not top-level fences', () => {
  const blocks = scanFencedBlocks('```mindmap\n```\n\n> ```mindmap\n> ```\n\n```mindmap\n```\n');
  assert.deepEqual(blocks.map((b) => b.line), [0, 6]);
});

test('a fence nested inside a longer fence is not split out', () => {
  const blocks = scanFencedBlocks('````md\n```mindmap\n- R\n```\n````\n');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].info, 'md');
  assert.equal(blocks[0].body, '```mindmap\n- R\n```');
});

test('a tilde fence closes only on tildes', () => {
  const [b] = scanFencedBlocks('~~~mindmap\n- R\n```\n~~~\n');
  assert.equal(b.body, '- R\n```');
});
