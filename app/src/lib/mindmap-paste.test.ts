import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { MindElixirData, NodeObj } from 'mind-elixir';
import { outlineToPlaintext, parsePaste, payloadOf, type PasteFormat } from './mindmap-paste.ts';
import { MAX_MINDMAP_FENCE_CHARS, MINDMAP_FENCE_ROOT_TOPIC } from './mindmap-fence.ts';

function ok(text: string) {
  const result = parsePaste(text);
  assert.ok(result.ok, `expected ok for ${JSON.stringify(text)}`);
  return result.payload;
}

test('empty and whitespace are rejected', () => {
  assert.deepEqual(parsePaste('  \n '), { ok: false, reason: 'empty' });
});

test('oversized text is rejected', () => {
  assert.deepEqual(parsePaste('x'.repeat(MAX_MINDMAP_FENCE_CHARS + 1)), { ok: false, reason: 'tooLarge' });
});

test('mmap envelope keeps its real root as one node, with arrows', () => {
  const text = JSON.stringify({ format: 'solomd-mindmap', version: 1, data: {
    nodeData: { id: 'root', topic: 'Plan', children: [{ id: 'a', topic: 'A' }, { id: 'b', topic: 'B' }] },
    arrows: [{ id: 'ar', label: '', from: 'a', to: 'b' }],
  } });
  const p = ok(text);
  assert.equal(p.format, 'mmap');
  assert.deepEqual(p.nodes.map((n) => n.topic), ['Plan']);
  assert.equal(p.arrows.length, 1);
});

test('mmap envelope whose root topic is Mind Map keeps that root as one node', () => {
  const text = JSON.stringify({ format: 'solomd-mindmap', version: 1, data: {
    nodeData: { id: 'root', topic: MINDMAP_FENCE_ROOT_TOPIC, children: [{ id: 'a', topic: 'A' }] },
  } });
  const p = ok(text);
  assert.equal(p.format, 'mmap');
  assert.deepEqual(p.nodes.map((n) => n.topic), [MINDMAP_FENCE_ROOT_TOPIC]);
});

test('bare map data, a single node and a node array are json', () => {
  assert.equal(ok(JSON.stringify({ nodeData: { id: 'r', topic: 'R' } })).nodes[0].topic, 'R');
  assert.equal(ok(JSON.stringify({ id: 'n', topic: 'N' })).format, 'json');
  assert.deepEqual(ok(JSON.stringify([{ id: 'x', topic: 'X' }, { id: 'y', topic: 'Y' }])).nodes.map((n) => n.id), ['x', 'y']);
});

test('json nodes are sanitized', () => {
  const p = ok(JSON.stringify({ id: 'n', topic: 'N', hyperLink: 'javascript:alert(1)', dangerouslySetInnerHTML: '<img>' }));
  assert.equal(p.nodes[0].hyperLink, undefined);
  assert.equal(p.nodes[0].dangerouslySetInnerHTML, undefined);
});

test('mindmap plaintext with one top line keeps that root', () => {
  const p = ok('- Root\n  - A\n  - B');
  assert.equal(p.format, 'plaintext');
  assert.deepEqual(p.nodes.map((n) => n.topic), ['Root']);
  assert.equal(p.nodes[0].children?.length, 2);
});

test('mindmap plaintext with several top lines inserts them as siblings', () => {
  assert.deepEqual(ok('- A\n- B').nodes.map((n) => n.topic), ['A', 'B']);
});

test('markdown headings become a subtree', () => {
  const p = ok('# Title\n\n## One\n\n## Two');
  assert.equal(p.format, 'markdown');
  assert.deepEqual(p.nodes.map((n) => n.topic), ['Title']);
  assert.deepEqual(p.nodes[0].children?.map((n) => n.topic), ['One', 'Two']);
});

test('tab-indented outline (XMind style) nests by indent', () => {
  const p = ok('Root\n\tA\n\t\tA1\n\tB');
  assert.equal(p.format, 'outline');
  assert.deepEqual(p.nodes.map((n) => n.topic), ['Root']);
  assert.deepEqual(p.nodes[0].children?.map((n) => n.topic), ['A', 'B']);
});

test('space-indented outline and flat multi-line text', () => {
  assert.deepEqual(ok('Root\n    A\n    B').nodes[0].children?.map((n) => n.topic), ['A', 'B']);
  assert.deepEqual(ok('one\nשתיים\nthree').nodes.map((n) => n.topic), ['one', 'שתיים', 'three']);
});

test('a single line becomes one node', () => {
  const p = ok('  just a thought  ');
  assert.equal(p.format, 'line');
  assert.deepEqual(p.nodes.map((n) => n.topic), ['just a thought']);
});

test('invalid JSON falls through to text handling', () => {
  assert.equal(ok('{ not json').format, 'line');
});

test('outlineToPlaintext converts indent levels to bullets', () => {
  assert.equal(outlineToPlaintext(['R', '\tA', '\t\tA1']), '- R\n  - A\n    - A1');
  assert.equal(outlineToPlaintext(['R', '  A', '    A1', '  B']), '- R\n  - A\n    - A1\n  - B');
});

const UNSAFE_FIELDS = { dangerouslySetInnerHTML: '<img>', hyperLink: 'javascript:alert(1)' };
const ALL_FORMATS: readonly PasteFormat[] = ['mmap', 'json', 'plaintext', 'markdown', 'outline', 'line'];

function unsafeData(rootTopic: string): MindElixirData {
  return { nodeData: { id: 'r', topic: rootTopic, ...UNSAFE_FIELDS, children: [{ id: 'c', topic: 'C', ...UNSAFE_FIELDS }] } };
}

function collect(nodes: readonly NodeObj[]): NodeObj[] {
  return nodes.flatMap((n) => [n, ...collect(n.children ?? [])]);
}

test('payloadOf sanitizes every node for every format, real or synthetic root', () => {
  for (const format of ALL_FORMATS) {
    for (const topic of ['Real', MINDMAP_FENCE_ROOT_TOPIC]) {
      const all = collect(payloadOf(format, unsafeData(topic)).nodes);
      assert.ok(all.length > 0);
      for (const n of all) {
        assert.equal(n.dangerouslySetInnerHTML, undefined, `${format}/${topic}/${n.id}`);
        assert.equal(n.hyperLink, undefined, `${format}/${topic}/${n.id}`);
      }
    }
  }
});
