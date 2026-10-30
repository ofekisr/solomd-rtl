import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EditorView } from '@codemirror/view';
import { stateWith, fakeView, fakeContext } from '../editor/contracts/testkit.ts';
import { convertPort } from '../../platform/index.ts';
import { createImageUploadFeature } from './contracts/index.ts';
import { imageSrcChanges, localImageSources, parseFrontMatterImageRoot } from './internal/image-links.ts';
import { uploadLocalImages } from './internal/upload-local-images.ts';
import { imagePasteOptionsFor } from './internal/image-paste-options.ts';


test('parseFrontMatterImageRoot reads the three key spellings', () => {
  assert.equal(parseFrontMatterImageRoot('---\nimageRoot: /a/b\n---\nx'), '/a/b');
  assert.equal(parseFrontMatterImageRoot('---\nimage_root: img\n---\nx'), 'img');
  assert.equal(parseFrontMatterImageRoot('---\ntypora-root-url: ../pics\n---\nx'), '../pics');
});

test('parseFrontMatterImageRoot strips quotes and handles missing front matter', () => {
  assert.equal(parseFrontMatterImageRoot('---\nimageRoot: "my dir"\n---\n'), 'my dir');
  assert.equal(parseFrontMatterImageRoot('# no front matter\nimageRoot: x'), undefined);
  assert.equal(parseFrontMatterImageRoot('---\ntitle: t\n---\n'), undefined);
});

test('localImageSources keeps unique local sources in order', () => {
  const doc = '![a](x.png) ![b](https://h/y.png) ![c](x.png) ![d](data:image/png;base64,AA) ![e](sub/z.jpg "t")';
  assert.deepEqual(localImageSources(doc), ['x.png', 'sub/z.jpg']);
});

test('imageSrcChanges replaces every occurrence and encodes spaces', () => {
  const doc = '![a](x.png) text ![b](x.png)';
  const changes = imageSrcChanges(doc, 'x.png', 'https://h/my pic.png');
  assert.equal(changes.length, 2);
  assert.deepEqual(changes[0], { from: 5, to: 10, insert: 'https://h/my%20pic.png' });
  assert.equal(doc.slice(changes[1].from, changes[1].to), 'x.png');
  assert.deepEqual(imageSrcChanges(doc, 'none.png', 'u'), []);
});

test('uploadLocalImages with no uploader toasts a hint and dispatches nothing', async () => {
  const fv = fakeView(stateWith([], '![a](x.png)'));
  const ctx = fakeContext({ settings: { imageUploader: 'none' }, view: () => fv as unknown as EditorView });
  await uploadLocalImages(ctx);
  assert.deepEqual(ctx.toasts, ['info:toast.noUploaderConfigured']);
  assert.equal(fv.dispatched.length, 0);
});

test('uploadLocalImages without a view returns silently', async () => {
  const ctx = fakeContext({ settings: { imageUploader: 'none' } });
  await uploadLocalImages(ctx);
  assert.deepEqual(ctx.toasts, []);
});

test('uploadLocalImages reports when the doc has no local images', async () => {
  const fv = fakeView(stateWith([], '![a](https://h/y.png)'));
  const ctx = fakeContext({
    settings: { imageUploader: 'picgo', picgoEndpoint: 'http://x/upload' },
    view: () => fv as unknown as EditorView,
  });
  await uploadLocalImages(ctx);
  assert.deepEqual(ctx.toasts, ['info:toast.noLocalImages']);
});

test('insertImageUrl runs insertMarkdown with an image snippet', () => {
  const runs: unknown[][] = [];
  const fv = fakeView(stateWith([], ''));
  const ctx = fakeContext({
    view: () => fv as unknown as EditorView,
    run: (command, ...args) => { runs.push([command, ...args]); },
  });
  const feature = createImageUploadFeature();
  feature.commands!.insertImageUrl(ctx, ' https://x/y.png ', 'alt');
  assert.deepEqual(runs, [['insertMarkdown', '![alt](https://x/y.png)']]);
});

test('insertImageUrl ignores a blank URL', () => {
  const runs: unknown[][] = [];
  const fv = fakeView(stateWith([], ''));
  const ctx = fakeContext({ view: () => fv as unknown as EditorView, run: (c) => { runs.push([c]); } });
  createImageUploadFeature().commands!.insertImageUrl(ctx, '   ');
  assert.equal(runs.length, 0);
});

test('imagePasteOptionsFor reads tab and settings and routes notify to toasts', () => {
  const ctx = fakeContext({
    settings: { attachmentMode: 'per-file', assetsDirName: 'assets', attachmentCustomPath: '/c', imageUploader: 'none' },
    tabValue: { filePath: '/n/a.md', content: 'body' },
  });
  const opts = imagePasteOptionsFor(ctx);
  assert.equal(opts.getFilePath(), '/n/a.md');
  assert.equal(opts.getDocContent(), 'body');
  assert.equal(opts.getAttachmentMode(), 'per-file');
  assert.equal(opts.getAssetsDirName(), 'assets');
  assert.equal(opts.getCustomPath(), '/c');
  assert.equal(opts.getUploader('a.png'), null);
  opts.notify('success', 'k1');
  opts.notify('error', 'k2');
  opts.notify('info', 'k3');
  assert.deepEqual(ctx.toasts, ['success:k1', 'error:k2', 'info:k3']);
});

test('manifest id and image-paste slot', () => {
  const feature = createImageUploadFeature();
  assert.equal(feature.id, 'image-upload');
  assert.ok(feature.extensions?.['image-paste']);
});

type UploadArgs = { config: unknown; path: string };
const uploadSettings = { imageUploader: 'picgo', picgoEndpoint: 'http://x/upload', imageUploadOnPaste: true };

async function withUploadStub<T>(impl: (a: UploadArgs) => Promise<string>, body: () => Promise<T>): Promise<T> {
  const port = convertPort as unknown as { uploadImage: (a: UploadArgs) => Promise<string> };
  const original = port.uploadImage;
  port.uploadImage = impl;
  try { return await body(); } finally { port.uploadImage = original; }
}

test('uploadLocalImages happy path rewrites links and toasts the count', async () => {
  const fv = fakeView(stateWith([], '![a](x.png) and ![b](x.png)'));
  const ctx = fakeContext({
    settings: uploadSettings,
    tabValue: { filePath: '/n/a.md', content: '' },
    view: () => fv as unknown as EditorView,
  });
  const paths: string[] = [];
  await withUploadStub(async (a) => { paths.push(a.path); return 'https://h/x.png'; }, () => uploadLocalImages(ctx));
  assert.equal(fv.state.doc.toString(), '![a](https://h/x.png) and ![b](https://h/x.png)');
  assert.deepEqual(paths, ['/n/x.png']);
  assert.deepEqual(ctx.toasts, ['info:toast.uploadingProgress {"done":1,"total":1}', 'success:toast.uploadedCount {"n":1}']);
});

test('uploadLocalImages error path logs, leaves the doc and toasts failure', async () => {
  const fv = fakeView(stateWith([], '![a](x.png)'));
  const ctx = fakeContext({
    settings: uploadSettings,
    tabValue: { filePath: '/n/a.md', content: '' },
    view: () => fv as unknown as EditorView,
  });
  const logged: unknown[][] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args); };
  try {
    await withUploadStub(async () => { throw new Error('boom'); }, () => uploadLocalImages(ctx));
  } finally { console.error = original; }
  assert.equal(fv.state.doc.toString(), '![a](x.png)');
  assert.equal(logged[0][0], '[Editor] uploadLocalImages failed for');
  assert.equal(logged[0][1], 'x.png');
  assert.equal(ctx.toasts.at(-1), 'error:toast.imageUploadFailedShort');
});

test('insertImageFromPath without a view is a no-op', async () => {
  const ctx = fakeContext({ settings: uploadSettings });
  await createImageUploadFeature().commands!.insertImageFromPath(ctx, '/p/a.png');
  assert.deepEqual(ctx.toasts, []);
});

test('insertImageFromPath delegates to the uploader and inserts the hosted link', async () => {
  const fv = fakeView(stateWith([], ''));
  const ctx = fakeContext({
    settings: { ...uploadSettings, attachmentMode: 'shared', assetsDirName: 'assets' },
    tabValue: { filePath: '/n/a.md' },
    view: () => fv as unknown as EditorView,
  });
  await withUploadStub(async () => 'https://h/up.png', async () => {
    await createImageUploadFeature().commands!.insertImageFromPath(ctx, '/p/a.png');
  });
  assert.ok(fv.state.doc.toString().includes('https://h/up.png'), fv.state.doc.toString());
});
