import assert from 'node:assert/strict';
import test from 'node:test';

import {
  completionSettingsStatus,
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
  directives: [],
};
const badWarning = { sourceFile: 'bad.json', reason: 'invalid JSON' };

test('status distinguishes clean, warning, and empty registries', () => {
  assert.deepEqual(completionSettingsStatus(loadResult([], [])), {
    loaded: 0,
    warningCount: 0,
  });
  assert.deepEqual(completionSettingsStatus(loadResult([epubManifest], [])), {
    loaded: 1,
    warningCount: 0,
  });
  assert.deepEqual(
    completionSettingsStatus(loadResult([epubManifest], [badWarning])),
    { loaded: 1, warningCount: 1 },
  );
});

function loadResult(
  manifests: readonly LoadedDirectiveCompletionManifest[],
  warnings: DirectiveCompletionLoadResult['warnings'],
): DirectiveCompletionLoadResult {
  return { directory: '/tmp/completions', manifests, warnings };
}
