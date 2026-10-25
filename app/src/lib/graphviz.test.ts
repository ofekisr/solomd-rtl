import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isGraphvizLang, renderDot } from './graphviz.ts';

test('dot, graphviz and gv fences count as Graphviz, case-insensitively', () => {
  assert.ok(isGraphvizLang('dot'));
  assert.ok(isGraphvizLang('Graphviz'));
  assert.ok(isGraphvizLang('gv'));
  assert.ok(!isGraphvizLang('mermaid'));
});

test('renderDot turns DOT into an SVG with the graph nodes', async () => {
  const svg = await renderDot('digraph { alpha -> beta }');
  assert.match(svg, /^<svg[\s>]/);
  assert.match(svg, /alpha/);
  assert.match(svg, /beta/);
});

test('renderDot dark theme colours unstyled ink light', async () => {
  const svg = await renderDot('digraph { a -> b }', 'dark');
  assert.match(svg, /#d4d4d4/i);
});

test('renderDot rejects invalid DOT', async () => {
  await assert.rejects(renderDot('digraph { a -> }'));
});
