import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildMindmapFence, insertBlockAfterLine, findMindmapFences, isMindmapFenceInfo, MAX_MINDMAP_FENCE_CHARS, MINDMAP_FENCE_ROOT_TOPIC,
  parseMindmapFence, replaceMindmapFence, safeInsertLine, serializeMindmapFence, mindmapFenceCodec,
} from './mindmap-fence.ts';
import { markdownToMindmap } from './mindmap-convert.ts';
import { preorderIds } from './mindmap-source.ts';
import { walkNodes } from './mindmap-gates.ts';

const OUTLINE = '- Root\n  - A [^a1]\n    - A1\n  - }:1 Group A\n  - B [^b1]\n  - > [^a1] <-relates-> [^b1]\n  - עברית';
const DOC = `# T\n\n\`\`\`mindmap\n${OUTLINE}\n\`\`\`\n\ntext\n\n\`\`\`js\nx\n\`\`\`\n\n\`\`\`mindmap\n- Second\n\`\`\`\n`;

test('info matcher is case-insensitive and ignores attributes', () => {
  assert.ok(isMindmapFenceInfo('MindMap height=300'));
  assert.ok(!isMindmapFenceInfo('mindmapx'));
});

test('finds only mindmap fences with their opening lines', () => {
  const fences = findMindmapFences(DOC);
  assert.deepEqual(fences.map((f) => f.line), [2, 18]);
  assert.equal(fences[1].body, '- Second');
});

test('parse keeps hierarchy, refs, summaries, arrows and Hebrew', () => {
  const parsed = parseMindmapFence(OUTLINE);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.data.nodeData.topic, 'Root');
  assert.equal(parsed.data.summaries?.length, 1);
  assert.equal(parsed.data.arrows?.length, 1);
  assert.equal(serializeMindmapFence(parsed.data), OUTLINE);
});

test('parse drops unsafe styles', () => {
  const parsed = parseMindmapFence('- R {"color":"#f00","background":"url(javascript:x)"}');
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(serializeMindmapFence(parsed.data), '- R {"color":"#f00"}');
});

test('empty body yields an empty map with the default root', () => {
  const parsed = parseMindmapFence('  \n');
  assert.ok(parsed.ok && parsed.isEmpty && parsed.data.nodeData.topic === MINDMAP_FENCE_ROOT_TOPIC);
});

test('oversized body is rejected', () => {
  const parsed = parseMindmapFence('- x'.repeat(MAX_MINDMAP_FENCE_CHARS));
  assert.equal(parsed.ok, false);
});

test('replace writes the fence at the target line and returns its line', () => {
  const result = replaceMindmapFence(DOC, { line: 18, body: '- Second' }, '- Second\n  - child');
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.line, 18);
  assert.equal(findMindmapFences(result.source)[1].body, '- Second\n  - child');
  assert.equal(findMindmapFences(result.source)[0].body, OUTLINE);
});

test('replace falls back to the unique body match when the line shifted', () => {
  const shifted = `\`\`\`mindmap\n- New first\n\`\`\`\n${DOC}`;
  const result = replaceMindmapFence(shifted, { line: 18, body: '- Second' }, '- Changed');
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.line, 21);
  assert.deepEqual(findMindmapFences(result.source).map((f) => f.body), ['- New first', OUTLINE, '- Changed']);
});

test('replace aborts when the body is gone or ambiguous', () => {
  assert.equal(replaceMindmapFence(DOC, { line: 2, body: '- Missing' }, '- X').ok, false);
  const twin = `${DOC}\n\`\`\`mindmap\n- Second\n\`\`\`\n`;
  assert.equal(replaceMindmapFence(twin, { line: 5, body: '- Second' }, '- X').ok, false);
});

const QUOTED = '```mindmap\n```\n\n> ```mindmap\n> ```\n\n```mindmap\n```\n';

test('a blockquote fence is not a mindmap fence', () => {
  assert.deepEqual(findMindmapFences(QUOTED).map((f) => f.line), [0, 6]);
});

test('replace by the top-level line writes only that fence', () => {
  const result = replaceMindmapFence(QUOTED, { line: 6, body: '' }, '- R');
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.source, '```mindmap\n```\n\n> ```mindmap\n> ```\n\n```mindmap\n- R\n```\n');
});

test('a missing target line with an ambiguous body fails', () => {
  assert.equal(replaceMindmapFence(QUOTED, { line: 3, body: '' }, '- R').ok, false);
});

test('replace re-indents the body of an indented fence and fills an empty one', () => {
  const indented = '- item\n\n  ```mindmap\n  - R\n    - A\n  ```\n';
  const [fence] = findMindmapFences(indented);
  assert.equal(fence.body, '- R\n  - A');
  const result = replaceMindmapFence(indented, { line: 2, body: fence.body }, '- R\n  - A\n  - B');
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.source, '- item\n\n  ```mindmap\n  - R\n    - A\n    - B\n  ```\n');
  const empty = replaceMindmapFence('```mindmap\n```\n', { line: 0, body: '' }, '- R');
  assert.ok(empty.ok && empty.source === '```mindmap\n- R\n```\n');
});

test('body comparison ignores CRLF and trailing whitespace', () => {
  const crlf = '```mindmap\r\n- R  \r\n```\r\n';
  assert.ok(replaceMindmapFence(crlf, { line: 0, body: '- R\n' }, '- S').ok);
});

test('gate lines round-trip through the fence codec', () => {
  const parsed = parseMindmapFence('- Root\n  - Alpha [^a1]\n  - => a1');
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(serializeMindmapFence(parsed.data), '- Root\n  - Alpha [^a1]\n  - => a1');
});

test('insertBlockAfterLine keeps one blank line around the block', () => {
  assert.equal(insertBlockAfterLine('a\nb\n\nc', 2, 'X'), 'a\nb\n\nX\n\nc');
  assert.equal(insertBlockAfterLine('a', 5, 'X'), 'a\n\nX\n');
});

test('buildMindmapFence wraps the serialized body', () => {
  const fence = buildMindmapFence({ nodeData: { id: 'root', topic: 'R', children: [{ id: 'n1', topic: 'A' }] } });
  assert.match(fence, /^```mindmap\n[\s\S]*- A[\s\S]*\n```$/);
});

test('converted markdown with grammar-like items survives the fence round trip', () => {
  const md = '# Doc\n- > quote\n- }:1 x\n- Results [^1]\n- => done\n- a [^1]';
  const data = markdownToMindmap(md, { rootTopic: 'R' });
  const parsed = mindmapFenceCodec.parse(findMindmapFences(buildMindmapFence(data))[0].body);
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(preorderIds(parsed.data.nodeData).length, preorderIds(data.nodeData).length);
  const topics = [...walkNodes(parsed.data.nodeData)].map((n) => n.topic);
  assert.deepEqual(topics, ['Doc', 'quote', 'x', 'Results', 'done', 'a']);
  for (const node of walkNodes(parsed.data.nodeData)) {
    const meta = (node.metadata ?? {}) as Record<string, unknown>;
    assert.equal(meta.refId, undefined);
    assert.equal(meta.gate, undefined);
    assert.equal(meta.arrow, undefined);
  }
  assert.equal((parsed.data.arrows ?? []).length, 0);
  assert.equal((parsed.data.summaries ?? []).length, 0);
});

test('safeInsertLine moves out of an open code fence', () => {
  const src = 'a\n```\ncode\nmore\n```\nb';
  assert.equal(safeInsertLine(src, 1), 1);
  assert.equal(safeInsertLine(src, 3), 5);
  assert.equal(safeInsertLine(src, 5), 5);
  assert.equal(safeInsertLine('x\n```\nopen', 3), 3);
  assert.equal(safeInsertLine('x\n```\nopen\nmore', 3), 4);
});
