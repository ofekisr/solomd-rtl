import type { WireBranch, WireTag } from './shared/models.ts'

export interface BranchTreeNode {
  id: string
  label: string
  kind: 'section' | 'folder' | 'branch' | 'tag'
  branch?: WireBranch
  tag?: WireTag
  children: BranchTreeNode[]
}

function insertBranch(root: BranchTreeNode, branch: WireBranch, displayName: string): void {
  const parts = displayName.split('/')
  let parent = root
  for (const folder of parts.slice(0, -1)) {
    const id = `${parent.id}/${folder}`
    let next = parent.children.find((c) => c.id === id)
    if (!next) {
      next = { id, label: folder, kind: 'folder', children: [] }
      parent.children.push(next)
    }
    parent = next
  }
  parent.children.push({ id: branch.id, label: parts[parts.length - 1] ?? displayName, kind: 'branch', branch, children: [] })
}

function section(id: string, label: string): BranchTreeNode {
  return { id, label, kind: 'section', children: [] }
}

export function buildBranchTree(branches: WireBranch[], tags: WireTag[]): BranchTreeNode[] {
  const local = section('local', 'Local')
  const remote = section('remote', 'Remote')
  for (const b of branches) {
    if (b.kind === 'local') insertBranch(local, b, b.name)
    else insertBranch(remote, b, b.name)
  }
  const tagSection = section('tags', 'Tags')
  tagSection.children = tags.map((tag) => ({ id: tag.id, label: tag.name, kind: 'tag' as const, tag, children: [] }))
  return [local, remote, tagSection]
}
