import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData } from 'mind-elixir';
import { withGateArrows } from './mindmap-graph.ts';
import { buildHtmlExport, buildTextExport, escapeScriptJson, exportFileName, isImageFormat } from './mindmap-export.ts';

const BREAKOUT = '</script><script>window.__pwn=1</script>';
const data = (topic: string): MindElixirData => ({
  nodeData: { id: 'root', topic: 'שורש', children: [{ id: 'a', topic }, { id: 'b', topic: 'B', children: [{ id: 'c', topic: 'C' }] }] },
});
const embeddedJson = (html: string): string => {
  const match = /const data = (.*)\n/.exec(html);
  assert.ok(match, 'data assignment present');
  return match[1];
};

test('escapeScriptJson removes every char that can end a script block', () => {
  const out = escapeScriptJson(JSON.stringify({ t: '</script>&\u2028\u2029' }));
  assert.equal(/[<>&\u2028\u2029]/.test(out), false);
  assert.deepEqual(JSON.parse(out), { t: '</script>&\u2028\u2029' });
});

test('html export cannot be broken out of by a topic', () => {
  const html = buildHtmlExport(data(BREAKOUT));
  assert.equal(html.includes(BREAKOUT), false);
  assert.equal(JSON.parse(embeddedJson(html)).nodeData.children[0].topic, BREAKOUT);
});

test('html export survives "$&" replacement patterns in topics', () => {
  const html = buildHtmlExport(data('cost $& $1'));
  assert.equal(JSON.parse(embeddedJson(html)).nodeData.children[0].topic, 'cost $& $1');
});

test('html export drops dangerouslySetInnerHTML', () => {
  const unsafe = data('A');
  unsafe.nodeData.dangerouslySetInnerHTML = '<img src=x onerror=alert(1)>';
  assert.equal(JSON.parse(embeddedJson(buildHtmlExport(unsafe))).nodeData.dangerouslySetInnerHTML, undefined);
});

test('json export is pretty, sanitized MindElixirData', () => {
  const parsed = JSON.parse(buildTextExport(data('A'), 'json'));
  assert.equal(parsed.nodeData.children[1].children[0].topic, 'C');
});

test('markdown export is a nested bullet list from the root', () => {
  assert.equal(buildTextExport(data('A'), 'markdown'), '- שורש\n  - A\n  - B\n    - C\n');
});

test('file names and format kinds', () => {
  assert.equal(exportFileName('plan', 'png'), 'plan.png');
  assert.equal(exportFileName('plan', 'markdown'), 'plan.md');
  assert.equal(isImageFormat('svg'), true);
  assert.equal(isImageFormat('json'), false);
});

test('graph text formats', () => {
  assert.equal(exportFileName('plan', 'adjacency'), 'plan.graph.json');
  assert.ok(buildTextExport(data('A'), 'mermaid').startsWith('graph LR\n'));
  assert.equal(JSON.parse(buildTextExport(data('A'), 'adjacency')).nodes.length, 4);
});

test('json and html exports of a gate-arrow map carry no gate-arrow ids', () => {
  const withGate: MindElixirData = { nodeData: { id: 'root', topic: 'R', children: [
    { id: 'a', topic: 'A' },
    { id: 'g', topic: '⇒ A', metadata: { gate: { target: 'a' } } },
  ] } };
  const arrowed = withGateArrows(withGate);
  assert.ok((arrowed.arrows ?? []).length > 0);
  assert.ok(!buildTextExport(arrowed, 'json').includes('gate-arrow-'));
  assert.ok(!buildTextExport(arrowed, 'html').includes('gate-arrow-'));
});

test('markdown export appends snippets', () => {
  const md = buildTextExport({ nodeData: { id: 'root', topic: 'R', children: [] } }, 'markdown', [{ id: 's1', kind: 'mermaid', title: 'F', body: 'graph LR' }]);
  assert.match(md, /```mermaid\ngraph LR\n```/);
});
