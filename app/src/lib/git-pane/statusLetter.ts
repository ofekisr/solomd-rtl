import type { WireFileStatus } from './shared/models.ts'

const LETTERS: Record<WireFileStatus, 'M' | 'A' | 'D' | 'R' | 'C' | '?' | 'U' | '!'> = {
  modified: 'M', added: 'A', deleted: 'D', renamed: 'R', copied: 'C', untracked: '?', conflicted: 'U', ignored: '!',
}

export function statusLetter(status: WireFileStatus): (typeof LETTERS)[WireFileStatus] {
  return LETTERS[status]
}
