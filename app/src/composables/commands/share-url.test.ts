import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildShareUrl, buildGitUrl } from './share-url.ts';

const gh = 'git@github.com:acme/notes.git';

test('buildShareUrl: relative path under the workspace', () => {
  assert.equal(
    buildShareUrl({ folder: '/w', filePath: '/w/a b/c.md', remoteUrl: gh }),
    'https://solomd.app/share/?repo=acme/notes&path=a%20b%2Fc.md',
  );
});

test('buildShareUrl: https remote and trailing slash on folder', () => {
  assert.equal(
    buildShareUrl({ folder: '/w/', filePath: '/w/c.md', remoteUrl: 'https://github.com/acme/notes' }),
    'https://solomd.app/share/?repo=acme/notes&path=c.md',
  );
});

test('buildShareUrl: windows separators become slashes', () => {
  assert.equal(
    buildShareUrl({ folder: 'C:\\w', filePath: 'C:\\w\\d\\c.md', remoteUrl: gh }),
    'https://solomd.app/share/?repo=acme/notes&path=d%2Fc.md',
  );
});

test('buildShareUrl: null without folder, file, github remote or containment', () => {
  assert.equal(buildShareUrl({ folder: null, filePath: '/w/c.md', remoteUrl: gh }), null);
  assert.equal(buildShareUrl({ folder: '/w', filePath: undefined, remoteUrl: gh }), null);
  assert.equal(buildShareUrl({ folder: '/w', filePath: '/w/c.md', remoteUrl: 'git@gitlab.com:a/b.git' }), null);
  assert.equal(buildShareUrl({ folder: '/w', filePath: '/other/c.md', remoteUrl: gh }), null);
});

test('buildGitUrl: github blob url, each segment encoded', () => {
  assert.equal(
    buildGitUrl({ folder: '/w', filePath: '/w/a b/c.md', remoteUrl: gh }),
    'https://github.com/acme/notes/blob/main/a%20b/c.md',
  );
});

test('buildGitUrl: gitlab uses /-/blob/', () => {
  assert.equal(
    buildGitUrl({ folder: '/w', filePath: '/w/c.md', remoteUrl: 'https://gitlab.com/g/p.git' }),
    'https://gitlab.com/g/p/-/blob/main/c.md',
  );
});

test('buildGitUrl: nested repo path keeps its slashes', () => {
  assert.equal(
    buildGitUrl({ folder: '/w', filePath: '/w/c.md', remoteUrl: 'https://git.example.com/g/sub/p.git' }),
    'https://git.example.com/g/sub/p/blob/main/c.md',
  );
});

test('buildGitUrl: null without remote match or containment', () => {
  assert.equal(buildGitUrl({ folder: '/w', filePath: '/w/c.md', remoteUrl: '' }), null);
  assert.equal(buildGitUrl({ folder: '/w', filePath: '/x/c.md', remoteUrl: gh }), null);
});
