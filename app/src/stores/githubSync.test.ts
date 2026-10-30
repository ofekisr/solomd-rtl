import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPullError, classifyPushError, isGithubAuthError } from './githubSync.ts';

test('auth errors', () => {
  assert.equal(isGithubAuthError(new Error('GitHub API 401 Unauthorized')), true);
  assert.equal(isGithubAuthError('Bad credentials'), true);
  assert.equal(isGithubAuthError('timeout'), false);
  assert.equal(isGithubAuthError(null), false);
});

test('push classification', () => {
  assert.equal(classifyPushError('401'), 'auth');
  assert.equal(classifyPushError('remote: protected branch hook declined'), 'protected-branch');
  assert.equal(classifyPushError('Create a pull request for'), 'protected-branch');
  assert.equal(classifyPushError('! [rejected] non-fast-forward'), 'non-fast-forward');
  assert.equal(classifyPushError('pull first'), 'non-fast-forward');
  assert.equal(classifyPushError('boom'), 'other');
});

test('pull classification', () => {
  assert.equal(classifyPullError('bad credentials'), 'auth');
  assert.equal(classifyPullError('CONFLICT in a.md'), 'conflict');
  assert.equal(classifyPullError('boom'), 'other');
});
