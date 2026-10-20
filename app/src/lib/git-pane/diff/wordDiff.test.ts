// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { diffWords, renderInlineDiff, shouldInlineHighlight } from './wordDiff.ts'

describe('diffWords', () => {
  it('marks only the changed value', () => {
    const { oldSegments, newSegments } = diffWords('const foo = 1', 'const foo = 2')
    assert.equal(oldSegments.filter((s) => s.changed).map((s) => s.text).join(''), '1')
    assert.equal(newSegments.filter((s) => s.changed).map((s) => s.text).join(''), '2')
    assert.ok(oldSegments.filter((s) => !s.changed).map((s) => s.text).join('').includes('const foo ='))
  })

  it('returns unchanged segments for identical lines', () => {
    const { oldSegments, newSegments } = diffWords('same', 'same')
    assert.equal(oldSegments.every((s) => !s.changed), true)
    assert.equal(newSegments.every((s) => !s.changed), true)
  })

  it('marks whole side changed when one side is empty', () => {
    const { newSegments } = diffWords('', 'new line')
    assert.equal((newSegments).length, 1)
    assert.equal(newSegments[0].changed, true)
  })

  it('refines single-token replacement to char level', () => {
    const { oldSegments } = diffWords('foo1', 'foo2')
    const changed = oldSegments.filter((s) => s.changed).map((s) => s.text).join('')
    assert.equal(changed, '1')
    assert.equal(oldSegments.map((s) => s.text).join(''), 'foo1')
  })
})

describe('shouldInlineHighlight', () => {
  it('rejects identical or empty pairs', () => {
    assert.equal(shouldInlineHighlight('a', 'a'), false)
    assert.equal(shouldInlineHighlight('', 'a'), false)
    assert.equal(shouldInlineHighlight('a', ''), false)
  })

  it('accepts real change pairs', () => {
    assert.equal(shouldInlineHighlight('const foo = 1', 'const foo = 2'), true)
  })
})

describe('renderInlineDiff', () => {
  it('wraps only changed words and escapes html', () => {
    const { oldHtml, newHtml } = renderInlineDiff('const foo = 1', 'const foo = 2', 'plaintext')
    assert.ok((newHtml).includes('diff-word-add'))
    assert.ok((oldHtml).includes('diff-word-del'))
    // Unchanged part is present without a word wrapper around the whole line.
    assert.ok((newHtml).includes('const foo ='))
    assert.doesNotMatch(newHtml, /^<span class="diff-word-add">.*<\/span>$/)
  })

  it('escapes markup in changed segments', () => {
    const { newHtml } = renderInlineDiff('a', 'a < b', 'plaintext')
    assert.ok((newHtml).includes('&lt;'))
    assert.ok(!(newHtml).includes('< b'))
  })

  it('keeps syntax highlighting inside unchanged code', () => {
    const { newHtml } = renderInlineDiff('const foo = 1', 'const foo = 2', 'javascript')
    assert.ok((newHtml).includes('hljs-keyword'))
    assert.ok((newHtml).includes('diff-word-add'))
  })
})
