import assert from 'node:assert/strict';
import test from 'node:test';

import {
  directiveCompletionManifests,
  directiveCompletionStatus,
  installDirectiveCompletionLoadResult,
  type DirectiveCompletionLoadResult,
  type LoadedDirectiveCompletionManifest,
} from './directive-completion-registry.ts';

const epubManifest: LoadedDirectiveCompletionManifest = {
  sourceFile: 'epub.json',
  schemaVersion: 1,
  grammar: {
    opening: '<!--',
    marker: 'epub:',
    closing: '-->',
    pairSeparator: ',',
    keyValueSeparator: '=',
  },
  directives: [{ key: 'style', type: 'enum', values: ['chapter'] }],
};

function loadResult(
  manifests: LoadedDirectiveCompletionManifest[],
  warnings: DirectiveCompletionLoadResult['warnings'],
): DirectiveCompletionLoadResult {
  return { directory: '/tmp/completions', manifests, warnings };
}

test('installs manifests and warnings without exposing mutable arrays', () => {
  const manifests = [epubManifest];
  const input = loadResult(manifests, [
    { sourceFile: 'bad.json', reason: 'invalid JSON' },
  ]);
  installDirectiveCompletionLoadResult(input);

  assert.equal(directiveCompletionManifests().length, 1);
  manifests.length = 0;
  assert.equal(directiveCompletionManifests().length, 1);
  assert.equal(directiveCompletionStatus().warnings[0]?.sourceFile, 'bad.json');
  assert.equal(Object.isFrozen(directiveCompletionManifests()), true);
});

test('empty installation clears a prior registry for browser harnesses', () => {
  installDirectiveCompletionLoadResult(loadResult([epubManifest], []));
  installDirectiveCompletionLoadResult(loadResult([], []));

  assert.deepEqual(directiveCompletionManifests(), []);
});
