import type { GitPaneService } from './service.ts'
import { createMockGitService, type MockSeed } from './mockGitService.ts'
import { createTauriGitService } from './tauriGitService.ts'

const MOCK_QUERY_FLAG = 'gitMock'

let service: GitPaneService | null = null

function wantsMock(): boolean {
  return typeof location !== 'undefined' && location.search.includes(MOCK_QUERY_FLAG) && Boolean(import.meta.env?.DEV)
}

const SEED_FLAGS: readonly (keyof MockSeed)[] = ['notARepo', 'noGit', 'untrusted', 'dirtyPull']

function seedFromQuery(): MockSeed {
  const flags = new URLSearchParams(location.search).get(MOCK_QUERY_FLAG)?.split(',') ?? []
  return Object.fromEntries(SEED_FLAGS.filter((flag) => flags.includes(flag)).map((flag) => [flag, true]))
}

export function getGitPaneService(): GitPaneService {
  service ??= wantsMock() ? createMockGitService(seedFromQuery()) : createTauriGitService()
  return service
}

export function setGitPaneService(next: GitPaneService): void {
  service = next
}

export function isGitMockActive(): boolean {
  return wantsMock()
}
