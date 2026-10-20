import type { WireWorkingTreeFile } from './shared/models.ts'

export type ChangeGroupId = 'conflicts' | 'staged' | 'changes' | 'unversioned'

export interface ChangeGroup {
  id: ChangeGroupId
  files: WireWorkingTreeFile[]
}

const GROUP_ORDER: ChangeGroupId[] = ['conflicts', 'staged', 'changes', 'unversioned']

function groupOf(file: WireWorkingTreeFile): ChangeGroupId {
  if (file.status === 'conflicted') return 'conflicts'
  if (file.status === 'untracked') return 'unversioned'
  return file.staged ? 'staged' : 'changes'
}

export function groupChanges(files: WireWorkingTreeFile[]): ChangeGroup[] {
  return GROUP_ORDER
    .map((id) => ({ id, files: files.filter((f) => groupOf(f) === id) }))
    .filter((g) => g.files.length > 0)
}
