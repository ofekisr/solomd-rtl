import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  parseImageRootFast,
  extFromMime,
  extFromName,
  dirnameOf,
  basenameNoExt,
  resolveAssetsDir,
  joinPath,
  makeFilename,
} from './image-paths.ts';

const GOLDEN = new URL('./image-paths.golden.json', import.meta.url);

function snapshot(): Record<string, unknown> {
  return {
    root: [
      '---\nimageRoot: "./img"\n---\nx',
      '---\nimage_root: /abs\n---',
      "---\ntypora-root-url: 'D:\\a'\n---",
      '---\ntitle: x\n---',
      'no fm',
    ].map(parseImageRootFast),
    mime: ['image/png', 'IMAGE/JPEG', 'image/jpg', 'image/svg+xml', 'image/tiff', 'image/x-unknown', ''].map(extFromMime),
    name: ['a.PNG', 'a.b.jpg', 'noext', '.hidden', 'a.'].map(extFromName),
    dirname: ['/a/b/c.md', '/c.md', 'c.md', 'C:\\a\\b.md', '/a/b/', '/', '\\x'].map((p) => dirnameOf(p, '/')),
    base: ['/a/b/foo.md', 'foo', '.md', 'C:\\x\\y.tar.gz', '/a/b/'].map(basenameNoExt),
    join: [['', 'b'], ['a', 'b'], ['a/', 'b'], ['a\\', 'b']].map(([a, b]) => joinPath(a, b, '/')),
    assets: [
      resolveAssetsDir('/n/doc.md', '/', 'shared', '_assets'),
      resolveAssetsDir('/n/doc.md', '/', 'shared', 'pics'),
      resolveAssetsDir('/n/doc.md', '/', 'per-file', '_assets'),
      resolveAssetsDir('/n/doc.md', '/', 'custom', '_assets'),
      resolveAssetsDir('/n/doc.md', '/', 'custom', '_assets', './img/${filename}/'),
      resolveAssetsDir('/n/doc.md', '/', 'custom', '_assets', '/abs/${filename}'),
      resolveAssetsDir('C:\\n\\doc.md', '\\', 'custom', '_assets', 'C:\\pics\\${filename}\\'),
      resolveAssetsDir('/n/doc.md', '/', 'custom', '_assets', '../up/./x'),
    ],
  };
}

test('image-paths helpers match golden snapshot', () => {
  const actual = JSON.parse(JSON.stringify(snapshot()));
  if (!existsSync(GOLDEN)) writeFileSync(GOLDEN, JSON.stringify(actual, null, 1));
  assert.deepEqual(actual, JSON.parse(readFileSync(GOLDEN, 'utf8')));
});

test('makeFilename shape', () => {
  assert.match(makeFilename('png'), /^image-\d{8}-\d{6}-[a-z0-9]{1,6}\.png$/);
});
