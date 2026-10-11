import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MindElixirData } from 'mind-elixir';
import {
  MINDMAP_EXTENSIONS,
  createEmptyMindmap,
  isMindmapPath,
  parseMindmap,
  rootTopicFromFileName,
  sanitizeMindmapData,
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

function envelopeWith(data: unknown): string {
  return JSON.stringify({ format: 'solomd-mindmap', version: 1, data });
}

function parseOk(text: string): MindElixirData {
  const parsed = parseMindmap(text, 'X');
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.data;
}

test('loaded nodes lose dangerouslySetInnerHTML at every depth', () => {
  const payload = '<img src=x onerror=alert(1)>';
  const data = parseOk(
    envelopeWith({
      nodeData: {
        id: 'r',
        topic: 'R',
        dangerouslySetInnerHTML: payload,
        children: [
          {
            id: 'a',
            topic: 'A',
            children: [{ id: 'b', topic: 'B', dangerouslySetInnerHTML: payload, children: [] }],
          },
        ],
      },
    }),
  );
  assert.equal(data.nodeData.dangerouslySetInnerHTML, undefined);
  const nested = data.nodeData.children?.[0].children?.[0];
  assert.equal(nested?.topic, 'B');
  assert.equal('dangerouslySetInnerHTML' in (nested ?? {}), false);
});

test('hyperLink keeps only http, https and mailto targets', () => {
  const linkFor = (hyperLink: string): string | undefined =>
    parseOk(envelopeWith({ nodeData: { id: 'r', topic: 'R', hyperLink } })).nodeData.hyperLink;
  assert.equal(linkFor('javascript:alert(1)'), undefined);
  assert.equal(linkFor('JaVaScRiPt:alert(1)'), undefined);
  assert.equal(linkFor('https://example.com'), 'https://example.com');
  assert.equal(linkFor('mailto:a@b.c'), 'mailto:a@b.c');
});

test('arrow and summary labels lose angle brackets', () => {
  const data = parseOk(
    envelopeWith({
      nodeData: { id: 'r', topic: 'R' },
      arrows: [{ id: 'x', label: '<img onerror=x>go', from: 'r', to: 'r' }],
      summaries: [{ id: 's', label: '<b>sum</b>', parent: 'r', start: 0, end: 0 }],
    }),
  );
  assert.equal(data.arrows?.[0].label, 'img onerror=xgo');
  assert.equal(data.summaries?.[0].label, 'bsum/b');
});

test('sanitizing is idempotent across a save and load cycle', () => {
  const once = parseOk(
    envelopeWith({
      nodeData: { id: 'r', topic: 'R', hyperLink: 'javascript:x', dangerouslySetInnerHTML: '<i>' },
      arrows: [{ id: 'x', label: '<a>', from: 'r', to: 'r' }],
    }),
  );
  assert.deepEqual(sanitizeMindmapData(once), once);
  assert.deepEqual(parseOk(serializeMindmap(once)), once);
});

test('non-string arrow and summary labels are dropped', () => {
  const data = parseOk(
    envelopeWith({
      nodeData: { id: 'r', topic: 'R' },
      arrows: [
        { id: 'a', label: ['<img src=x onerror=alert(1)>'], from: 'r', to: 'r' },
        { id: 'b', label: { x: '<img>' }, from: 'r', to: 'r' },
      ],
      summaries: [{ id: 's', label: 42, parent: 'r', start: 0, end: 0 }],
    }),
  );
  assert.equal(data.arrows?.length, 2);
  assert.equal('label' in (data.arrows?.[0] ?? {}), false);
  assert.equal('label' in (data.arrows?.[1] ?? {}), false);
  assert.equal('label' in (data.summaries?.[0] ?? {}), false);
});

test('arrows that are not an array are dropped', () => {
  const data = parseOk(
    envelopeWith({ nodeData: { id: 'r', topic: 'R' }, arrows: { id: 'x', label: '<b>' } }),
  );
  assert.equal(data.arrows, undefined);
});

test('summaries that are not an array are dropped', () => {
  const data = parseOk(envelopeWith({ nodeData: { id: 'r', topic: 'R' }, summaries: '<img>' }));
  assert.equal(data.summaries, undefined);
});

test('non-object entries in arrow lists do not crash the parser', () => {
  const parsed = parseMindmap(
    envelopeWith({ nodeData: { id: 'r', topic: 'R' }, arrows: [null, 7, 'x'] }),
    'X',
  );
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.data.arrows, []);
});
