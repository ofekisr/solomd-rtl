import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import { parseMindmap } from './mindmap-format.ts';
import { convertXmind } from './xmind-import.ts';
import {
  MAX_XMIND_BYTES,
  MAX_XMIND_CONTENT_BYTES,
  XMIND_CONTENT_TOO_LARGE_ERROR,
  XMIND_TOO_LARGE_ERROR,
} from './xmind-limits.ts';

async function zipOf(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: 'uint8array' });
}

function topic(id: string, title: string, extra: Record<string, unknown> = {}) {
  return { id, class: 'topic', title, ...extra };
}

const ZEN_SHEETS = [
  {
    id: 's1',
    class: 'sheet',
    title: 'גיליון',
    rootTopic: topic('r', 'מפה ראשית', {
      children: {
        attached: [
          topic('a', 'ענף א', {
            notes: { plain: { content: 'הערה' } },
            labels: ['תווית'],
            href: 'javascript:alert(1)',
            branch: 'folded',
            image: { src: 'xap:resources/x.png', width: 10, height: 10 },
            children: { attached: [topic('a1', 'leaf 1'), topic('a2', 'leaf 2')], summary: [topic('st', 'סיכום')] },
            summaries: [{ id: 'sum', range: '(0,1)', topicId: 'st' }],
          }),
          topic('b', 'Branch B', { href: 'https://example.com' }),
        ],
      },
    }),
    relationships: [{ id: 'rel', end1Id: 'a1', end2Id: 'b', title: '<b>קשר</b>' }],
  },
  { id: 's2', class: 'sheet', title: 'Second', rootTopic: topic('r2', 'Second root') },
];

const LEGACY_XML =
  '<?xml version="1.0" encoding="UTF-8"?><xmap-content xmlns="urn:xmind:xmap:xmlns:content:2.0" version="2.0">' +
  '<sheet id="L1"><topic id="lr"><title>שורש</title><children><topics type="attached">' +
  '<topic id="l1" branch="folded"><title>legacy child</title><notes><plain>legacy note</plain></notes></topic>' +
  '</topics></children></topic><title>Legacy</title></sheet></xmap-content>';

async function importOk(bytes: Uint8Array) {
  const result = await convertXmind(bytes, 'map.xmind');
  assert.equal(result.ok, true, result.ok ? '' : result.error);
  if (!result.ok) throw new Error(result.error);
  const parsed = parseMindmap(result.text, 'fallback');
  if (!parsed.ok) throw new Error(parsed.error);
  return { result, data: parsed.data };
}

test('Zen JSON imports the first sheet as a valid .mmap document', async () => {
  const { result, data } = await importOk(await zipOf({ 'content.json': JSON.stringify(ZEN_SHEETS) }));
  assert.equal(result.extraSheetCount, 1);
  assert.equal(data.nodeData.topic, 'מפה ראשית');
  const a = data.nodeData.children?.[0];
  assert.equal(a?.note, 'הערה');
  assert.equal(a?.expanded, false);
  assert.deepEqual(a?.tags, ['תווית']);
  assert.equal(a?.children?.length, 2);
  assert.equal(data.nodeData.children?.[1].hyperLink, 'https://example.com');
  assert.equal(data.summaries?.length, 1);
  assert.equal(data.arrows?.length, 1);
});

test('imported data is sanitized', async () => {
  const { data } = await importOk(await zipOf({ 'content.json': JSON.stringify(ZEN_SHEETS) }));
  const a = data.nodeData.children?.[0];
  assert.equal(a?.hyperLink, undefined);
  assert.equal(a?.image, undefined);
  assert.equal(data.arrows?.[0].label, 'bקשר/b');
});

test('legacy XMind 8 XML imports', async () => {
  const { result, data } = await importOk(await zipOf({ 'content.xml': LEGACY_XML }));
  assert.equal(result.extraSheetCount, 0);
  assert.equal(data.nodeData.topic, 'שורש');
  assert.equal(data.nodeData.children?.[0].note, 'legacy note');
});

test('a topic without a title becomes an empty topic instead of failing', async () => {
  const sheets = [{ id: 's', class: 'sheet', rootTopic: { id: 'r', children: { attached: [{ id: 'c' }] } } }];
  const { data } = await importOk(await zipOf({ 'content.json': JSON.stringify(sheets) }));
  assert.equal(data.nodeData.topic, '');
  assert.equal(data.nodeData.children?.[0].topic, '');
});

test('malformed files return an error instead of throwing', async () => {
  const cases: Uint8Array[] = [
    new TextEncoder().encode('not a zip'),
    await zipOf({ 'other.txt': 'x' }),
    await zipOf({ 'content.json': '[]' }),
    await zipOf({ 'content.json': '{bad json' }),
    await zipOf({ 'content.json': JSON.stringify([{ id: 's', class: 'sheet' }]) }),
  ];
  for (const bytes of cases) {
    const result = await convertXmind(bytes, 'bad.xmind');
    assert.equal(result.ok, false);
  }
});

test('hostile style values are stripped on import', async () => {
  const sheets = [
    {
      id: 's',
      class: 'sheet',
      title: 'S',
      rootTopic: topic('r', 'Root', {
        style: { properties: { 'svg:fill': 'url(https://evil.example/t.png)', 'fo:color': '#ff0000' } },
      }),
    },
  ];
  const { data } = await importOk(await zipOf({ 'content.json': JSON.stringify(sheets) }));
  assert.equal(data.nodeData.style?.background, undefined);
  assert.equal(data.nodeData.style?.color, '#ff0000');
});

test('input over the size cap is rejected before parsing', async () => {
  const result = await convertXmind(new Uint8Array(MAX_XMIND_BYTES + 1), 'big.xmind');
  assert.deepEqual(result, { ok: false, error: XMIND_TOO_LARGE_ERROR });
});

test('a zip whose content expands past the cap is rejected', async () => {
  const padding = ' '.repeat(MAX_XMIND_CONTENT_BYTES + 1);
  const zip = new JSZip();
  zip.file('content.json', `[]${padding}`);
  const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  const result = await convertXmind(bytes, 'bomb.xmind');
  assert.deepEqual(result, { ok: false, error: XMIND_CONTENT_TOO_LARGE_ERROR });
});
