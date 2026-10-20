// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import type { DiffHunk } from '../shared/models.ts'
import { buildSplitRows } from './buildSplitRows.ts'

function line(
  type: 'context' | 'add' | 'del',
  content: string,
  oldLine: number | null,
  newLine: number | null,
) {
  return { type, content, oldLine, newLine }
}

describe('buildSplitRows', () => {
  it('pairs context lines on both sides', () => {
    const hunks: DiffHunk[] = [
      {
        header: '@@ -1,2 +1,2 @@',
        oldStart: 1,
        oldLines: 2,
        newStart: 1,
        newLines: 2,
        lines: [line('context', 'unchanged', 1, 1)],
      },
    ]
    const rows = buildSplitRows(hunks)
    const data = rows.filter((r) => r.kind === 'line')
    assert.equal((data).length, 1)
    if (data[0].kind === 'line') {
      assert.equal(data[0].left.content, 'unchanged')
      assert.equal(data[0].right.content, 'unchanged')
      assert.equal(data[0].left.lineNum, 1)
      assert.equal(data[0].right.lineNum, 1)
    }
  })

  it('pairs del/add blocks side by side', () => {
    const hunks: DiffHunk[] = [
      {
        header: '@@ -2,2 +2,2 @@',
        oldStart: 2,
        oldLines: 2,
        newStart: 2,
        newLines: 2,
        lines: [
          line('del', 'old line', 2, null),
          line('add', 'new line', null, 2),
        ],
      },
    ]
    const rows = buildSplitRows(hunks)
    const data = rows.filter((r) => r.kind === 'line')
    assert.equal((data).length, 1)
    if (data[0].kind === 'line') {
      assert.equal(data[0].left.type, 'del')
      assert.equal(data[0].right.type, 'add')
      assert.equal(data[0].left.content, 'old line')
      assert.equal(data[0].right.content, 'new line')
    }
  })

  it('handles uneven del/add counts', () => {
    const hunks: DiffHunk[] = [
      {
        header: '@@ -1,3 +1,2 @@',
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 2,
        lines: [
          line('del', 'a', 1, null),
          line('del', 'b', 2, null),
          line('add', 'c', null, 1),
        ],
      },
    ]
    const rows = buildSplitRows(hunks)
    const data = rows.filter((r) => r.kind === 'line')
    assert.equal((data).length, 2)
    if (data[0].kind === 'line' && data[1].kind === 'line') {
      assert.equal(data[0].left.type, 'del')
      assert.equal(data[0].right.type, 'add')
      assert.equal(data[1].left.type, 'del')
      assert.equal(data[1].right.type, 'empty')
    }
  })
})
