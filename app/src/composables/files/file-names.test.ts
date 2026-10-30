import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveNameFromHeading,
  contentUriName,
  contentUriFileName,
  stripFileUrl,
  isIosContainerPath,
  reanchorIosPath,
} from './file-names.ts';
import { fileExtension } from './file-kinds.ts';

const untitled = (content: string, language = 'markdown') =>
  ({ filePath: undefined, fileName: 'Untitled', content, language }) as Parameters<typeof deriveNameFromHeading>[0];

test('deriveNameFromHeading: first heading names an untitled note', () => {
  assert.equal(deriveNameFromHeading(untitled('# Meeting notes\nbody')), 'Meeting notes.md');
});

test('deriveNameFromHeading: non-markdown gets .txt', () => {
  assert.equal(deriveNameFromHeading(untitled('# Plan', 'plaintext')), 'Plan.txt');
});

test('deriveNameFromHeading: path-unsafe characters become underscores', () => {
  assert.equal(deriveNameFromHeading(untitled('# a/b:c#d')), 'a_b_c_d.md');
});

test('deriveNameFromHeading: inert once saved or renamed', () => {
  assert.equal(deriveNameFromHeading({ ...untitled('# x'), filePath: '/a/b.md' }), null);
  assert.equal(deriveNameFromHeading({ ...untitled('# x'), fileName: 'notes.md' }), null);
});

test('deriveNameFromHeading: empty or symbol-only stems give null', () => {
  assert.equal(deriveNameFromHeading(untitled('no heading')), null);
  assert.equal(deriveNameFromHeading(untitled('# ///')), null);
  assert.equal(deriveNameFromHeading(untitled('# ...')), null);
});

test('contentUriName: decodes the last segment', () => {
  assert.equal(contentUriName('content://x/document/primary%3ADownload%2Fnote.md'), 'note.md');
});

test('contentUriName: malformed encoding falls back to the raw tail', () => {
  assert.equal(contentUriName('content://x/%E0%A4%A/note.md'), 'note.md');
});

test('contentUriFileName: name encoded in the URI wins', () => {
  const bytes = new TextEncoder().encode('# Heading');
  assert.equal(contentUriFileName('content://x/primary%3ADownload%2Fa%3Ab.md', bytes, 1), 'b.md');
});

test('contentUriFileName: opaque id uses the first heading of a text payload', () => {
  const bytes = new TextEncoder().encode('# My: Note\nbody');
  assert.equal(contentUriFileName('content://x/msf:29', bytes, 1), 'My_ Note.md');
});

test('contentUriFileName: binary or headless payload gets a timestamped name', () => {
  assert.equal(contentUriFileName('content://x/msf:29', new Uint8Array([0, 1, 2]), 42), 'imported-42.md');
  assert.equal(contentUriFileName('content://x/msf:29', new TextEncoder().encode('plain'), 7), 'imported-7.md');
});

test('stripFileUrl: strips scheme and decodes', () => {
  assert.equal(stripFileUrl('file:///tmp/My%20Note.md'), '/tmp/My Note.md');
  assert.equal(stripFileUrl('file://localhost/tmp/a.md'), '/tmp/a.md');
});

test('stripFileUrl: plain paths pass through; bad encoding keeps the stripped path', () => {
  assert.equal(stripFileUrl('/tmp/a.md'), '/tmp/a.md');
  assert.equal(stripFileUrl('file:///tmp/%E0%A4%A.md'), '/tmp/%E0%A4%A.md');
});

test('iOS container paths are re-anchored on the current root', () => {
  const stale = '/private/var/mobile/Containers/Data/Application/OLD-UUID/Documents/n.md';
  assert.equal(isIosContainerPath(stale), true);
  assert.equal(
    reanchorIosPath(stale, '/private/var/mobile/Containers/Data/Application/NEW/Documents'),
    '/private/var/mobile/Containers/Data/Application/NEW/Documents/n.md',
  );
  assert.equal(isIosContainerPath('/Users/me/Application/x.md'), false);
});

test('fileExtension: lower-cased last segment, empty without a dot', () => {
  assert.equal(fileExtension('/a/B.PNG'), 'png');
  assert.equal(fileExtension('noext'), 'noext');
  assert.equal(fileExtension(''), '');
});
