import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findMindmapFences, isMindmapFenceInfo, MAX_MINDMAP_FENCE_CHARS, MINDMAP_FENCE_ROOT_TOPIC,
  parseMindmapFence, replaceMindmapFence, serializeMindmapFence,
} from './mindmap-fence.ts';

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
