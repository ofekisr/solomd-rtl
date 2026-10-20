// Ported from git-light (https://github.com/ftuyama/git-light) @ 56f2ce7
// Copyright (c) ftuyama — MIT License. Modified for SoloMD.

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { computeGraphLayout, extendGraphLayout } from './computeGraphLayout.ts'
import type { GraphCommit } from './computeGraphLayout.ts'

function makeCommit(sha: string, parents: string[]): GraphCommit {
  return { sha, parents, isMerge: parents.length > 1 }
}

describe('computeGraphLayout', () => {
  it('keeps a linear history in a single lane', () => {
    const commits = [
      makeCommit('c', ['b']),
      makeCommit('b', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    assert.equal(layout.maxLanes, 1)
    assert.deepEqual(layout.nodes.map((node) => node.lane), [0, 0, 0])
  })

  it('assigns a second lane for a branch and merge', () => {
    // m merges feature(f) into main; f branched from a.
    const commits = [
      makeCommit('m', ['d', 'f']),
      makeCommit('d', ['a']),
      makeCommit('f', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    assert.ok((layout.maxLanes) >= 2)
    // The merge commit claims lane 0, its merge parent reserves another lane.
    assert.equal(layout.nodes[0].lane, 0)
    assert.ok((layout.nodes.find((node) => node.sha === 'f')!.lane) > 0)
  })

  it('produces a fan-out edge from a merge commit to its second parent', () => {
    const commits = [
      makeCommit('m', ['d', 'f']),
      makeCommit('d', ['a']),
      makeCommit('f', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    const mergeBand = layout.bands[0]
    const diagonal = mergeBand.find((edge) => edge.fromLane !== edge.toLane)
    assert.notEqual(diagonal, undefined)
  })

  it('tags only merge fan-outs with a merge edge kind', () => {
    const commits = [
      makeCommit('m', ['d', 'f']),
      makeCommit('d', ['a']),
      makeCommit('f', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    const mergeBand = layout.bands[0]
    const mergeFork = mergeBand.find((edge) => edge.fromLane !== edge.toLane)
    assert.equal(mergeFork?.kind, 'merge')
    assert.equal(mergeBand.some((edge) => edge.fromLane === 1 && edge.toLane === 1), true)
  })

  it('frees a lane after a branch converges on the main line', () => {
    const commits = [
      makeCommit('m', ['d', 'f']),
      makeCommit('d', ['a']),
      makeCommit('f', ['a']),
      makeCommit('a', []),
    ]
    const layout = computeGraphLayout(commits)
    assert.equal(layout.nodes.find((node) => node.sha === 'a')!.lane, 0)
  })

  it('handles an octopus merge with three parents', () => {
    const commits = [
      makeCommit('m', ['a', 'b', 'c']),
      makeCommit('a', ['z']),
      makeCommit('b', ['z']),
      makeCommit('c', ['z']),
      makeCommit('z', []),
    ]
    const layout = computeGraphLayout(commits)
    assert.ok((layout.maxLanes) >= 3)
  })

  it('ignores parents outside the commit set', () => {
    const commits = [makeCommit('c', ['missing'])]
    const layout = computeGraphLayout(commits)
    assert.equal((layout.nodes).length, 1)
    assert.equal((layout.bands[0]).length, 0)
  })

  it('extendGraphLayout matches full layout when appending older commits', () => {
    const firstPage = [
      makeCommit('m', ['d', 'f']),
      makeCommit('d', ['a']),
    ]
    const secondPage = [makeCommit('f', ['a']), makeCommit('a', [])]
    const partial = computeGraphLayout(firstPage)
    const extended = extendGraphLayout(firstPage, secondPage, partial)
    const full = computeGraphLayout([...firstPage, ...secondPage])
    assert.deepEqual(extended.nodes.map((n) => n.lane), full.nodes.map((n) => n.lane))
    assert.equal(extended.maxLanes, full.maxLanes)
    assert.equal(extended.bands.length, full.bands.length)
  })
})
