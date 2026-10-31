import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workspace } from './fixtures.ts';
import { create, exportMap, reveal, revealUrl } from '../src/tools/file.ts';
import { outline } from '../src/tools/read.ts';

test('create from outline and from markdown, refusing overwrite', async () => {
  const { store } = await workspace();
  await create(store, { file: 'new.mmap', from: 'outline', source: '- A\n  - B', root: 'Ideas' });
  assert.match(await outline(store, { file: 'new.mmap' }), /^- Ideas \[\^\w+\]\n {2}- A/);
  await create(store, { file: 'md.mmap', from: 'markdown', source: '# Doc\n## One\n## Two' });
  assert.match(await outline(store, { file: 'md.mmap' }), /One/);
  await assert.rejects(create(store, { file: 'plan.mmap', from: 'outline', source: '- x' }), /already exists/);
});

test('export formats', async () => {
  const { store } = await workspace();
  assert.match(await exportMap(store, { file: 'plan.mmap', format: 'outline' }), /- Plan \[\^r\]/);
  assert.match(await exportMap(store, { file: 'plan.mmap', format: 'mermaid' }), /mindmap|graph|flowchart/);
  assert.match(await exportMap(store, { file: 'plan.mmap', format: 'headings' }), /# Plan/);
});

test('reveal opens the file and reports the node without a link', async () => {
  const { store, dir } = await workspace();
  const calls: string[][] = [];
  const res = await reveal(store, { file: 'plan.mmap', node: 'Plan/Phase 2' }, async (args) => { calls.push(args); });
  assert.equal(calls[0].at(-1), `${dir}/plan.mmap`);
  assert.equal(res, 'Opened plan.mmap in SoloMD. Node focus is not supported yet; the node is [^a] Plan/Phase 2');
  assert.doesNotMatch(res, /solomd:\/\//);
  assert.equal((await reveal(store, { file: 'plan.mmap' }, async () => {})), 'Opened plan.mmap in SoloMD');
  assert.equal(revealUrl('/x/p.mmap', 'a'), 'solomd://open?path=%2Fx%2Fp.mmap&node=a');
});
