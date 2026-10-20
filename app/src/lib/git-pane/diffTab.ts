import type { DiffSide } from './service.ts'

const SCHEME = 'git-diff://'
const SIDES: DiffSide[] = ['worktree', 'index', 'commit']

export interface DiffTabRef {
  path: string
  side: DiffSide
  sha?: string
}

export function isDiffPath(p?: string): boolean {
  return typeof p === 'string' && p.startsWith(SCHEME)
}

export function encodeDiffPath(ref: DiffTabRef): string {
  const query = new URLSearchParams({ side: ref.side })
  if (ref.sha) query.set('sha', ref.sha)
  return `${SCHEME}${encodeURIComponent(ref.path)}?${query.toString()}`
}

export function decodeDiffPath(uri: string): DiffTabRef | null {
  if (!isDiffPath(uri)) return null
  const [encodedPath, rawQuery = ''] = uri.slice(SCHEME.length).split('?')
  const query = new URLSearchParams(rawQuery)
  const side = query.get('side') as DiffSide | null
  if (!side || !SIDES.includes(side)) return null
  const sha = query.get('sha') ?? undefined
  return sha ? { path: decodeURIComponent(encodedPath), side, sha } : { path: decodeURIComponent(encodedPath), side }
}
