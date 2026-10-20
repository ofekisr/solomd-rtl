import type { GitPaneService } from './service.ts'
import { createMockGitService } from './mockGitService.ts'
import { createTauriGitService } from './tauriGitService.ts'

const MOCK_QUERY_FLAG = 'gitMock'

let service: GitPaneService | null = null

function wantsMock(): boolean {
  return typeof location !== 'undefined' && location.search.includes(MOCK_QUERY_FLAG) && Boolean(import.meta.env?.DEV)
}

export function getGitPaneService(): GitPaneService {
  service ??= wantsMock() ? createMockGitService() : createTauriGitService()
  return service
}

export function setGitPaneService(next: GitPaneService): void {
  service = next
}

export function isGitMockActive(): boolean {
  return wantsMock()
}
