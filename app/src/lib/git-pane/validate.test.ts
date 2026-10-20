import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ensure, isSnapshot, isEnvelope, isGitErrorPayload, toGitPaneError } from './validate.ts'
import { GitPaneError } from './service.ts'
import { sampleSnapshot } from './mockGitService.ts'

test('accepts a well-formed snapshot', () => {
  assert.ok(isSnapshot(sampleSnapshot()))
})

test('rejects a snapshot missing workingTree', () => {
  const broken = { ...sampleSnapshot(), workingTree: undefined }
  assert.equal(isSnapshot(broken), false)
})

test('ensure throws a protocol error on bad payload', () => {
  assert.throws(() => ensure({ nope: 1 }, isEnvelope, 'action result'), (e: unknown) =>
    e instanceof GitPaneError && e.code === 'protocol')
})

test('recognises the Rust GitError marker', () => {
  const payload = { __gitError: true, code: 'Authentication', message: 'denied' }
  assert.ok(isGitErrorPayload(payload))
  const err = toGitPaneError(payload)
  assert.equal(err.code, 'Authentication')
  assert.equal(err.message, 'denied')
})

test('wraps unknown rejections', () => {
  assert.equal(toGitPaneError('boom').code, 'unknown')
})
