import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MindElixirData } from 'mind-elixir';
import {
  MINDMAP_EXTENSIONS,
  createEmptyMindmap,
  isMindmapPath,
  isXmindPath,
  mmapCodec,
  mmapPathFor,
  parseMindmap,
  rootTopicFromFileName,
  sanitizeMindmapData,
  sanitizeNodeObj,
  serializeMindmap,
} from './mindmap-format.ts';

test('mindmap extensions are .mmap and .xmind', () => {
  assert.deepEqual([...MINDMAP_EXTENSIONS], ['mmap', 'xmind']);
  assert.equal(isMindmapPath('/notes/Plan.MMAP'), true);
  assert.equal(isMindmapPath('C:\\maps\\plan.mmap'), true);
  assert.equal(isMindmapPath('/maps/Old.XMind'), true);
  assert.equal(isMindmapPath('/notes/plan.md'), false);
  assert.equal(isMindmapPath('mmap'), false);
});

test('isXmindPath matches only .xmind', () => {
  assert.equal(isXmindPath('/maps/Old.XMIND'), true);
  assert.equal(isXmindPath('/maps/plan.mmap'), false);
  assert.equal(isXmindPath('xmind'), false);
});

test('mmapPathFor swaps the extension and keeps the folder', () => {
  assert.equal(mmapPathFor('/Users/me/maps/ledger v1.3.xmind'), '/Users/me/maps/ledger v1.3.mmap');
  assert.equal(mmapPathFor('C:\\maps\\מפה.xmind'), 'C:\\maps\\מפה.mmap');
  assert.equal(mmapPathFor('/maps.d/noext'), '/maps.d/noext.mmap');
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

test('sanitizeNodeObj rejects values that are not node objects', () => {
  const cases: unknown[] = [null, 7, 'x', [], { topic: 'no id' }, { id: 'a', topic: 'A', children: [{ id: 'b' }] }];
  for (const value of cases) assert.equal(sanitizeNodeObj(value), null, JSON.stringify(value));
});

test('sanitizeNodeObj strips HTML and unsafe links at every depth', () => {
  const clean = sanitizeNodeObj({
    id: 'a',
    topic: 'A',
    dangerouslySetInnerHTML: '<img src=x onerror=alert(1)>',
    hyperLink: 'javascript:alert(1)',
    children: [{ id: 'b', topic: 'B', dangerouslySetInnerHTML: '<i>', hyperLink: 'https://ok.example' }],
  });
  assert.ok(clean);
  assert.equal('dangerouslySetInnerHTML' in clean, false);
  assert.equal('hyperLink' in clean, false);
  const child = clean.children?.[0];
  assert.equal(child?.topic, 'B');
  assert.equal('dangerouslySetInnerHTML' in (child ?? {}), false);
  assert.equal(child?.hyperLink, 'https://ok.example');
});

test('loaded data drops the persisted theme', () => {
  const data = parseOk(
    envelopeWith({ nodeData: { id: 'r', topic: 'R' }, theme: { name: 'Dark', palette: [], cssVar: {} } }),
  );
  assert.equal('theme' in data, false);
});

test('serialized data holds document fields only', () => {
  const data = {
    nodeData: { id: 'r', topic: 'R' },
    arrows: [],
    summaries: [],
    direction: 2,
    theme: { name: 'Dark', palette: [], cssVar: {} },
    compact: true,
    meta: { x: 1 },
    extra: 'nope',
  } as unknown as MindElixirData;
  const json = JSON.parse(serializeMindmap(data));
  assert.deepEqual(Object.keys(json.data).sort(), ['arrows', 'direction', 'nodeData', 'summaries']);
});

test('direction is kept only when it is a known layout value', () => {
  const directionFor = (direction: unknown): unknown =>
    parseOk(envelopeWith({ nodeData: { id: 'r', topic: 'R' }, direction })).direction;
  for (const valid of [0, 1, 2, 3]) assert.equal(directionFor(valid), valid);
  for (const invalid of [4, -1, 1.5, '1', null, 'side']) assert.equal(directionFor(invalid), undefined, String(invalid));
});

test('icons keep only string entries', () => {
  const node = sanitizeNodeObj({ id: 'a', topic: 't', icons: ['⭐', 5, { x: 1 }, '✅'] });
  assert.deepEqual(node?.icons, ['⭐', '✅']);
});

test('non-array icons and tags are removed', () => {
  const node = sanitizeNodeObj({ id: 'a', topic: 't', icons: 'nope', tags: { text: 'x' } });
  assert.equal(node?.icons, undefined);
  assert.equal(node?.tags, undefined);
});

test('tags keep strings and text objects, dropping style and className', () => {
  const node = sanitizeNodeObj({
    id: 'a',
    topic: 't',
    tags: ['תווית', { text: 'ok', className: 'evil', style: { background: 'url(x)' } }, { text: 3 }, null],
  });
  assert.deepEqual(node?.tags, ['תווית', { text: 'ok' }]);
});

test('image is kept only for http(s) urls with positive size', () => {
  const ok = { url: 'https://example.com/a.png', width: 10, height: 20 };
  assert.deepEqual(sanitizeNodeObj({ id: 'a', topic: 't', image: ok })?.image, ok);
  for (const image of [
    { url: 'xap:resources/a.png', width: 10, height: 10 },
    { url: 'javascript:alert(1)', width: 10, height: 10 },
    { url: 'https://example.com/a.png', width: 0, height: 10 },
    { url: 'https://example.com/a.png' },
    'https://example.com/a.png',
  ]) {
    assert.equal(sanitizeNodeObj({ id: 'a', topic: 't', image })?.image, undefined);
  }
});

test('nested children are sanitized too', () => {
  const node = sanitizeNodeObj({ id: 'r', topic: 'r', children: [{ id: 'c', topic: 'c', icons: [1] }] });
  assert.deepEqual(node?.children?.[0].icons, []);
});

function styledNode(style: unknown) {
  return parseOk(envelopeWith({ nodeData: { id: 'r', topic: 'R', style, children: [] } })).nodeData.style;
}

test('style values with url() are dropped', () => {
  const style = styledNode({ background: 'url(https://evil.example/t.png)', color: '#ff0000' });
  assert.equal(style?.background, undefined);
  assert.equal(style?.color, '#ff0000');
});

test('style keys outside the allowlist are dropped', () => {
  const style = styledNode({ position: 'fixed', color: '#00ff00' });
  assert.deepEqual(style, { color: '#00ff00' });
});

test('non-string style values are dropped', () => {
  assert.deepEqual(styledNode({ color: 5, background: '#ff0000' }), { background: '#ff0000' });
});

test('style values with CSS escapes are dropped', () => {
  const node = sanitizeNodeObj({
    id: 'a',
    topic: 't',
    style: { background: '\\75 rl(https://evil.example/t.png)', color: 'u\\72l(x)' },
  });
  assert.equal(node?.style, undefined);
});

test('style values with CSS escapes are dropped while safe values stay', () => {
  assert.deepEqual(styledNode({ background: 'u\\72l(x)', color: '#ff0000' }), { color: '#ff0000' });
});

test('safe style values are kept', () => {
  assert.deepEqual(styledNode({ color: '#ff0000', background: '#ff0000' }), {
    color: '#ff0000',
    background: '#ff0000',
  });
});

test('a style that is not an object, or is empty after filtering, is removed', () => {
  assert.equal(styledNode('color: red'), undefined);
  assert.equal(styledNode({ position: 'fixed' }), undefined);
});

test('mmapCodec round-trips through parse and serialize', () => {
  const codec = mmapCodec('plan.mmap');
  const parsed = codec.parse('');
  assert.ok(parsed.ok);
  if (!parsed.ok) return;
  assert.equal(parsed.data.nodeData.topic, 'plan');
  assert.ok(codec.parse(codec.serialize(parsed.data)).ok);
});

test('display block round-trips through the envelope', () => {
  const data = createEmptyMindmap('Root');
  const text = serializeMindmap(data, { compact: true, font: 'serif' });
  const parsed = parseMindmap(text, 'Root');
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.display, { compact: true, font: 'serif' });
});

test('empty display is omitted from the file', () => {
  const text = serializeMindmap(createEmptyMindmap('Root'), {});
  assert.equal(JSON.parse(text).display, undefined);
});

test('invalid display values are dropped on parse', () => {
  const text = JSON.stringify({ format: 'solomd-mindmap', version: 1, data: createEmptyMindmap('R'), display: { textColor: 'expression(x)', compact: 'yes' } });
  const parsed = parseMindmap(text, 'R');
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.display, {});
});

test('empty-string style values are dropped on sanitize', () => {
  const node = sanitizeNodeObj({ id: 'n1', topic: 'A', style: { fontWeight: '', color: '#111' } });
  assert.deepEqual(node?.style, { color: '#111' });
  const cleared = sanitizeNodeObj({ id: 'n2', topic: 'B', style: { fontWeight: '' } });
  assert.equal(cleared?.style, undefined);
});
