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

test('finds only mindmap fences, indexed in document order', () => {
  const fences = findMindmapFences(DOC);
  assert.deepEqual(fences.map((f) => f.index), [0, 1]);
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

test('replace writes the fence at the index when its body still matches', () => {
  const result = replaceMindmapFence(DOC, { index: 1, body: '- Second' }, '- Second\n  - child');
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(findMindmapFences(result.source)[1].body, '- Second\n  - child');
  assert.equal(findMindmapFences(result.source)[0].body, OUTLINE);
});

test('replace falls back to the unique body match when the index shifted', () => {
  const shifted = `\`\`\`mindmap\n- New first\n\`\`\`\n${DOC}`;
  const result = replaceMindmapFence(shifted, { index: 1, body: '- Second' }, '- Changed');
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(findMindmapFences(result.source).map((f) => f.body), ['- New first', OUTLINE, '- Changed']);
});

test('replace aborts when the body is gone or ambiguous', () => {
  assert.equal(replaceMindmapFence(DOC, { index: 0, body: '- Missing' }, '- X').ok, false);
  const twin = `${DOC}\n\`\`\`mindmap\n- Second\n\`\`\`\n`;
  assert.equal(replaceMindmapFence(twin, { index: 5, body: '- Second' }, '- X').ok, false);
});

test('replace re-indents the body of an indented fence and fills an empty one', () => {
  const indented = '- item\n\n  ```mindmap\n  - R\n  ```\n';
  const result = replaceMindmapFence(indented, { index: 0, body: '- R' }, '- R\n  - A');
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.source, '- item\n\n  ```mindmap\n  - R\n    - A\n  ```\n');
  const empty = replaceMindmapFence('```mindmap\n```\n', { index: 0, body: '' }, '- R');
  assert.ok(empty.ok && empty.source === '```mindmap\n- R\n```\n');
});

test('body comparison ignores CRLF and trailing whitespace', () => {
  const crlf = '```mindmap\r\n- R  \r\n```\r\n';
  assert.ok(replaceMindmapFence(crlf, { index: 0, body: '- R\n' }, '- S').ok);
});
