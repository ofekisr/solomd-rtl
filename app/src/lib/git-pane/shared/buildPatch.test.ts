// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { DiffHunk } from './models.ts'
import { buildPatchFromHunk, buildPatchFromHunkLines } from './buildPatch.ts'

const sampleHunk: DiffHunk = {
  header: '@@ -1,4 +1,5 @@',
  oldStart: 1,
  oldLines: 4,
  newStart: 1,
  newLines: 5,
  lines: [
    { type: 'context', content: 'line1', oldLine: 1, newLine: 1 },
    { type: 'del', content: 'old line', oldLine: 2, newLine: null },
    { type: 'add', content: 'new line', oldLine: null, newLine: 2 },
    { type: 'context', content: 'line3', oldLine: 3, newLine: 3 },
    { type: 'add', content: 'extra', oldLine: null, newLine: 4 },
  ],
}

describe('buildPatchFromHunk', () => {
  it('emits a valid unified diff header and body', () => {
    const patch = buildPatchFromHunk('src/foo.ts', sampleHunk)
    assert.ok((patch).includes('diff --git a/src/foo.ts b/src/foo.ts'))
    assert.ok((patch).includes('--- a/src/foo.ts'))
    assert.ok((patch).includes('+++ b/src/foo.ts'))
    assert.ok((patch).includes('@@ -1,4 +1,5 @@'))
    assert.ok((patch).includes('-old line'))
    assert.ok((patch).includes('+new line'))
  })

  it('uses oldPath for renames', () => {
    const patch = buildPatchFromHunk('src/new.ts', sampleHunk, 'src/old.ts')
    assert.ok((patch).includes('diff --git a/src/old.ts b/src/new.ts'))
    assert.ok((patch).includes('--- a/src/old.ts'))
    assert.ok((patch).includes('+++ b/src/new.ts'))
  })
})

describe('buildPatchFromHunkLines', () => {
  it('includes only selected change lines', () => {
    const patch = buildPatchFromHunkLines('file.txt', sampleHunk, [4])
    assert.ok((patch).includes('+extra'))
    assert.ok(!(patch).includes('-old line'))
    assert.ok(!(patch).includes('+new line'))
    assert.match(patch, /@@ -\d+,\d+ \+\d+,\d+ @@/)
  })

  it('groups multiple selected lines in one hunk', () => {
    const patch = buildPatchFromHunkLines('file.txt', sampleHunk, [1, 2])
    assert.ok((patch).includes('-old line'))
    assert.ok((patch).includes('+new line'))
    assert.ok(!(patch).includes('+extra'))
  })

  it('includes leading context for mid-file replacement', () => {
    const patch = buildPatchFromHunkLines('file.txt', sampleHunk, [1, 2])
    assert.ok((patch).includes(' line1'))
    assert.ok((patch).includes('@@ -1,3 +1,3 @@'))
  })

  it('includes leading context for mid-file insertion', () => {
    const patch = buildPatchFromHunkLines('file.txt', sampleHunk, [4])
    assert.ok((patch).includes(' line3'))
    assert.ok((patch).includes('@@ -3,1 +3,2 @@'))
  })

  it('anchors add-only selection with preceding context', () => {
    const midFileHunk: DiffHunk = {
      header: '@@ -10,3 +10,4 @@',
      oldStart: 10,
      oldLines: 3,
      newStart: 10,
      newLines: 4,
      lines: [
        { type: 'context', content: 'before', oldLine: 10, newLine: 10 },
        { type: 'context', content: 'anchor', oldLine: 11, newLine: 11 },
        { type: 'add', content: 'inserted', oldLine: null, newLine: 12 },
        { type: 'context', content: 'after', oldLine: 12, newLine: 13 },
      ],
    }
    const patch = buildPatchFromHunkLines('file.txt', midFileHunk, [2])
    assert.ok((patch).includes(' anchor'))
    assert.ok((patch).includes('+inserted'))
    assert.ok((patch).includes('@@ -10,3 +10,4 @@'))
  })
})
