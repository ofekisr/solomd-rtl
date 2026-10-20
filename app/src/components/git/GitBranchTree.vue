<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGitPaneStore } from '../../stores/gitPane';
import { useI18n } from '../../i18n';
import { buildBranchTree, type BranchTreeNode } from '../../lib/git-pane/branchTree';
import GitBranchNode from './GitBranchNode.vue';

const SECTION_TITLE_KEYS: Record<string, string> = {
  local: 'git.localBranches',
  remote: 'git.remoteBranches',
  tags: 'git.tags',
};

const git = useGitPaneStore();
const { t } = useI18n();
const query = ref('');
const collapsed = ref(new Set<string>());

const tree = computed(() => buildBranchTree(git.snapshot?.branches ?? [], git.snapshot?.tags ?? []));

function matches(node: BranchTreeNode): boolean {
  const q = query.value.trim().toLowerCase();
  if (!q) return true;
  if (node.kind === 'branch' || node.kind === 'tag') {
    return node.label.toLowerCase().includes(q) || (node.branch?.name ?? '').toLowerCase().includes(q);
  }
  return node.children.some(matches);
}

function toggle(id: string): void {
  const next = new Set(collapsed.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsed.value = next;
}

async function checkout(node: BranchTreeNode): Promise<void> {
  const branch = node.branch;
  if (!branch || branch.isCurrent) return;
  if (branch.kind === 'local') {
    await git.run({ kind: 'checkout', target: branch.name });
    return;
  }
  const remote = branch.remote ?? branch.name.split('/')[0] ?? '';
  const shortName = branch.name.startsWith(`${remote}/`) ? branch.name.slice(remote.length + 1) : branch.name;
  await git.run({ kind: 'checkout', target: shortName, meta: { remote } });
}

async function onContext(node: BranchTreeNode): Promise<void> {
  if (!node.branch || node.branch.kind !== 'local' || node.branch.isCurrent) return;
  if (!window.confirm(t('git.confirmDeleteBranch', { branch: node.branch.name }))) return;
  await git.run({ kind: 'delete-branch', target: node.branch.name });
}

function select(node: BranchTreeNode): void {
  const sha = node.branch?.tipSha ?? node.tag?.sha;
  if (sha) void git.selectCommit(sha);
}
</script>

<template>
  <div class="git-branches">
    <input v-model="query" class="git-search" :placeholder="t('git.searchBranches')" />
    <div class="git-branches__list">
      <div class="git-row" @click="git.selectCommit(git.snapshot?.repository.headSha ?? null)">
        <strong>HEAD</strong>&nbsp;<span dir="auto">({{ git.currentBranch }})</span>
      </div>
      <template v-for="section in tree" :key="section.id">
        <template v-if="matches(section)">
          <div class="git-group-title" @click="toggle(section.id)">
            {{ collapsed.has(section.id) ? '▸' : '▾' }} {{ t(SECTION_TITLE_KEYS[section.id] ?? section.label) }}
          </div>
          <template v-if="!collapsed.has(section.id)">
            <GitBranchNode
              v-for="child in section.children.filter(matches)"
              :key="child.id"
              :node="child"
              :depth="1"
              :collapsed="collapsed"
              @toggle="toggle"
              @select="select"
              @checkout="checkout"
              @context="onContext"
            />
          </template>
        </template>
      </template>
    </div>
  </div>
</template>
