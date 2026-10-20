<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGitPaneStore } from '../../stores/gitPane';
import { useI18n } from '../../i18n';
import { buildBranchTree, type BranchTreeNode } from '../../lib/git-pane/branchTree';
import { useGitBranchCreate } from '../../composables/useGitBranchCreate';
import GitBranchNode from './GitBranchNode.vue';
import GitMenu, { type GitMenuItem } from './GitMenu.vue';

const SECTION_TITLE_KEYS: Record<string, string> = {
  local: 'git.localBranches',
  remote: 'git.remoteBranches',
  tags: 'git.tags',
};

const git = useGitPaneStore();
const { t } = useI18n();
const query = ref('');
const collapsed = ref(new Set<string>());

const rawTree = computed(() => buildBranchTree(git.snapshot?.branches ?? [], git.snapshot?.tags ?? []));
const { createBranchFrom } = useGitBranchCreate();
const menu = ref<{ node: BranchTreeNode; x: number; y: number } | null>(null);

function isLeafMatch(node: BranchTreeNode, q: string): boolean {
  return node.label.toLowerCase().includes(q) || (node.branch?.name ?? '').toLowerCase().includes(q);
}

function prune(node: BranchTreeNode, q: string): BranchTreeNode | null {
  if (node.kind === 'branch' || node.kind === 'tag') return isLeafMatch(node, q) ? node : null;
  const children = node.children.map((c) => prune(c, q)).filter((c): c is BranchTreeNode => c !== null);
  return children.length ? { ...node, children } : null;
}

const tree = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return rawTree.value;
  return rawTree.value.map((s) => prune(s, q)).filter((s): s is BranchTreeNode => s !== null);
});

const menuItems = computed<GitMenuItem[]>(() => {
  const node = menu.value?.node;
  if (!node) return [];
  const branch = node.branch;
  const items: GitMenuItem[] = [];
  if (branch && !branch.isCurrent) items.push({ id: 'checkout', label: t('git.checkout') });
  items.push({ id: 'new-branch', label: t('git.newBranchFromHere') });
  if (branch?.kind === 'local' && !branch.isCurrent) items.push({ id: 'delete', label: t('git.deleteBranch') });
  if (branch?.isCurrent) items.push({ id: 'push', label: t('git.push') }, { id: 'update', label: t('git.update') });
  return items;
});

function toggle(id: string): void {
  const next = new Set(collapsed.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  collapsed.value = next;
}

function requestCheckout(name: string, remote?: string): void {
  window.dispatchEvent(new CustomEvent('gitpane:checkout', { detail: { name, remote } }));
}

function checkout(node: BranchTreeNode): void {
  const branch = node.branch;
  if (!branch || branch.isCurrent) return;
  if (branch.kind === 'local') {
    requestCheckout(branch.name);
    return;
  }
  const remote = branch.remote ?? branch.name.split('/')[0] ?? '';
  const shortName = branch.name.startsWith(`${remote}/`) ? branch.name.slice(remote.length + 1) : branch.name;
  requestCheckout(shortName, remote);
}

function onContext(node: BranchTreeNode, ev: MouseEvent): void {
  if (node.kind === 'folder') return;
  menu.value = { node, x: ev.clientX, y: ev.clientY };
}

async function onMenuSelect(id: string): Promise<void> {
  const node = menu.value?.node;
  menu.value = null;
  if (!node) return;
  if (id === 'checkout') checkout(node);
  else if (id === 'new-branch') await createBranchFrom(node.branch?.tipSha ?? node.tag?.sha ?? '');
  else if (id === 'delete') await deleteBranch(node);
  else if (id === 'push') await git.run({ kind: 'push' });
  else if (id === 'update') await git.run({ kind: 'pull' });
}

async function deleteBranch(node: BranchTreeNode): Promise<void> {
  if (!node.branch) return;
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
          <div class="git-group-title" @click="toggle(section.id)">
            {{ collapsed.has(section.id) ? '▸' : '▾' }} {{ t(SECTION_TITLE_KEYS[section.id] ?? section.label) }}
          </div>
          <template v-if="!collapsed.has(section.id)">
            <GitBranchNode
              v-for="child in section.children"
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
    </div>
    <GitMenu v-if="menu" :x="menu.x" :y="menu.y" :items="menuItems" @select="onMenuSelect" @close="menu = null" />
  </div>
</template>
