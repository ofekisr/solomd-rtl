import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MINDMAP_EXTENSIONS,
  createEmptyMindmap,
  isMindmapPath,
  parseMindmap,
  rootTopicFromFileName,
  serializeMindmap,
} from './mindmap-format.ts';

test('Phase 1 recognizes only .mmap', () => {
  assert.deepEqual([...MINDMAP_EXTENSIONS], ['mmap']);
  assert.equal(isMindmapPath('/notes/Plan.MMAP'), true);
  assert.equal(isMindmapPath('C:\\maps\\plan.mmap'), true);
  assert.equal(isMindmapPath('/notes/plan.md'), false);
  assert.equal(isMindmapPath('mmap'), false);
});

test('root topic comes from the file name without extension', () => {
  assert.equal(rootTopicFromFileName('Project Plan.mmap'), 'Project Plan');
  assert.equal(rootTopicFromFileName('Untitled.mmap'), 'Untitled');
  assert.equal(rootTopicFromFileName(''), 'Untitled');
});

test('serialize then parse round-trips the map', () => {
  const data = createEmptyMindmap('Root');
  data.nodeData.children = [{ id: 'a', topic: 'Child', children: [] }];
  const parsed = parseMindmap(serializeMindmap(data), 'Fallback');
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.isEmpty, false);
  assert.equal(parsed.data.nodeData.topic, 'Root');
  assert.equal(parsed.data.nodeData.children?.[0].topic, 'Child');
});

test('serialized output is a versioned, indented envelope', () => {
  const text = serializeMindmap(createEmptyMindmap('Root'));
  const json = JSON.parse(text);
  assert.equal(json.format, 'solomd-mindmap');
  assert.equal(json.version, 1);
  assert.ok(text.includes('\n  "format"'));
  assert.ok(text.endsWith('\n'));
});

test('empty or whitespace text opens as a new map named after the file', () => {
  const parsed = parseMindmap('  \n', 'Ideas');
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.isEmpty, true);
  assert.equal(parsed.data.nodeData.topic, 'Ideas');
});

test('invalid input returns a typed error instead of throwing', () => {
  const cases = [
    '{not json',
    '{"format":"other","version":1,"data":{"nodeData":{"id":"r","topic":"R"}}}',
    '{"format":"solomd-mindmap","version":2,"data":{"nodeData":{"id":"r","topic":"R"}}}',
    '{"format":"solomd-mindmap","version":1,"data":{}}',
    '{"format":"solomd-mindmap","version":1,"data":{"nodeData":{"id":"r","topic":"R","children":[{"topic":"no id"}]}}}',
  ];
  for (const text of cases) {
    const parsed = parseMindmap(text, 'X');
    assert.equal(parsed.ok, false, text);
    if (!parsed.ok) assert.ok(parsed.error.length > 0);
  }
});
