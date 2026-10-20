<script setup lang="ts">
import { computed, ref } from 'vue';
import { useGitPaneStore } from '../../stores/gitPane';
import { useWorkspaceStore } from '../../stores/workspace';
import { useTabsStore } from '../../stores/tabs';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';
import { useFiles } from '../../composables/useFiles';
import { groupChanges, type ChangeGroupId } from '../../lib/git-pane/groupChanges';
import type { WireWorkingTreeFile } from '../../lib/git-pane/shared/models';
import { getGitPaneService } from '../../lib/git-pane/serviceFactory';
import GitChangeRow from './GitChangeRow.vue';
import GitEmptyState from './GitEmptyState.vue';
import GitMenu, { type GitMenuItem } from './GitMenu.vue';

const GROUP_LABEL: Record<ChangeGroupId, string> = {
  conflicts: 'git.groupConflicts',
  staged: 'git.groupStaged',
  changes: 'git.groupChanges',
  unversioned: 'git.groupUnversioned',
};

const git = useGitPaneStore();
const workspace = useWorkspaceStore();
const tabs = useTabsStore();
const toasts = useToastsStore();
const files = useFiles();
const { t } = useI18n();
const messageEl = ref<HTMLTextAreaElement | null>(null);
const selectedPath = ref<string | null>(null);
const menu = ref<{ file: WireWorkingTreeFile; x: number; y: number } | null>(null);

const groups = computed(() => groupChanges(git.snapshot?.workingTree ?? []));
const emptyStatus = computed(() => {
  if (!workspace.currentFolder && git.status === 'idle') return 'no-folder' as const;
  if (git.status !== 'ready') return git.status;
  return groups.value.length === 0 ? ('no-changes' as const) : null;
});

function openDiff(file: WireWorkingTreeFile): void {
  tabs.openGitDiff({ path: file.path, side: file.staged ? 'index' : 'worktree' });
}

function openFile(file: WireWorkingTreeFile): void {
  if (!git.repoRoot) return;
  void files.openPath(`${git.repoRoot}/${file.path}`);
}

function toggle(file: WireWorkingTreeFile): void {
  if (file.staged) void git.run({ kind: 'unstage', target: file.path });
  else git.toggleIncluded(file.path);
}

function isRollbackable(file: WireWorkingTreeFile): boolean {
  return file.status !== 'untracked' && file.status !== 'conflicted';
}

function isNewStaged(file: WireWorkingTreeFile): boolean {
  return file.staged && file.status === 'added';
}

function rollbackConfirmText(targets: WireWorkingTreeFile[]): string {
  const isSingle = targets.length === 1;
  const name = targets[0].fileName;
  const count = targets.length;
  if (targets.every(isNewStaged)) {
    return isSingle ? t('git.confirmUnstageNew', { name }) : t('git.confirmUnstageNewMany', { count });
  }
  return isSingle ? t('git.confirmRollback', { name }) : t('git.confirmRollbackMany', { count });
}

async function rollbackFiles(candidates: WireWorkingTreeFile[]): Promise<void> {
  const targets = [...new Map(candidates.filter(isRollbackable).map((f) => [f.path, f])).values()];
  if (targets.length === 0) return;
  if (!window.confirm(rollbackConfirmText(targets))) return;
  for (const file of targets) {
    if (file.staged && !(await git.run({ kind: 'unstage', target: file.path }))) return;
    if (!isNewStaged(file) && !(await git.run({ kind: 'discard-file', target: file.path }))) return;
  }
}

const allFiles = computed(() => git.snapshot?.workingTree ?? []);
const toolbarTargets = computed(() =>
  allFiles.value.filter((f) => isRollbackable(f) && (git.included.includes(f.path) || f.path === selectedPath.value)),
);

function openMenu(file: WireWorkingTreeFile, ev: MouseEvent): void {
  selectedPath.value = file.path;
  menu.value = { file, x: ev.clientX, y: ev.clientY };
}

const menuItems = computed<GitMenuItem[]>(() => [
  { id: 'show-diff', label: t('git.showDiff') },
  { id: 'open-file', label: t('git.openFile') },
  { id: 'rollback', label: t('git.rollback'), disabled: !(menu.value && isRollbackable(menu.value.file)) },
]);

function onMenuSelect(id: string): void {
  if (id === 'show-diff') menuAction(openDiff);
  else if (id === 'open-file') menuAction(openFile);
  else if (id === 'rollback') menuAction((f) => rollbackFiles([f]));
}

function closeMenu(): void {
  menu.value = null;
}

function menuAction(action: (file: WireWorkingTreeFile) => void | Promise<void>): void {
  const file = menu.value?.file;
  closeMenu();
  if (file) void action(file);
}

async function commit(push: boolean): Promise<void> {
  if (push) {
    window.dispatchEvent(new CustomEvent('gitpane:open-push', { detail: { commitFirst: true } }));
    return;
  }
  const count = git.stagedFiles.length + git.included.length;
  const ok = await git.commit({ push: false });
  if (ok) toasts.success(t('git.committed', { count }));
  else if (git.lastError) toasts.error(git.lastError.message);
}

function onMessageKey(e: KeyboardEvent): void {
  const isMod = e.metaKey || e.ctrlKey;
  if (!isMod || e.key !== 'Enter') return;
  e.preventDefault();
  void commit(false);
}

async function initRepo(): Promise<void> {
  const folder = workspace.currentFolder;
  if (!folder) return;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('git_init_workspace', { folder, initialMessage: null, excludeAssets: false });
    await git.open(folder);
  } catch (e) {
    toasts.error(String(e));
  }
}

defineExpose({ focusMessage: () => messageEl.value?.focus() });
</script>

<template>
  <section class="git-panel" :aria-label="t('git.commitPanelTitle')">
    <div class="git-toolbar">
      <button :title="t('git.refresh')" :aria-label="t('git.refresh')" @click="git.refresh()">⟳</button>
      <button :title="t('git.rollback')" :aria-label="t('git.rollback')" :disabled="toolbarTargets.length === 0 || !!git.busyOp" @click="rollbackFiles(toolbarTargets)">↶</button>
      <button :title="t('git.fetch')" :aria-label="t('git.fetch')" :disabled="!!git.busyOp" @click="git.run({ kind: 'fetch' })">⇣</button>
    </div>
    <div v-if="git.busyOp" class="git-busy">
      {{ t('git.busy', { op: git.busyOp }) }}
      <button :title="t('git.cancel')" :aria-label="t('git.cancel')" @click="getGitPaneService().cancel()">✕</button>
    </div>
    <GitEmptyState v-if="emptyStatus" :status="emptyStatus" @init="initRepo" />
    <div v-else class="git-groups">
      <div v-for="group in groups" :key="group.id">
        <div class="git-group-title">{{ t(GROUP_LABEL[group.id]) }} <span>{{ group.files.length }}</span></div>
        <GitChangeRow
          v-for="file in group.files"
          :key="file.id"
          :file="file"
          :is-staged="file.staged"
          :included="git.included.includes(file.path)"
          :is-selected="selectedPath === file.path"
          @select="selectedPath = file.path"
          @toggle="toggle(file)"
          @open-diff="openDiff(file)"
          @open-file="openFile(file)"
          @context="openMenu(file, $event)"
        />
      </div>
    </div>
    <GitMenu v-if="menu" :x="menu.x" :y="menu.y" :items="menuItems" @select="onMenuSelect" @close="closeMenu" />
    <div v-if="git.status === 'ready'" class="git-commit-box">
      <textarea
        ref="messageEl"
        v-model="git.message"
        dir="auto"
        :placeholder="t('git.messagePlaceholder')"
        @keydown="onMessageKey"
      />
      <div class="git-commit-actions">
        <label><input v-model="git.amend" type="checkbox" /> {{ t('git.amend') }}</label>
        <span class="spacer" />
        <button class="git-btn git-btn--primary" :disabled="!git.canCommit" @click="commit(false)">{{ t('git.commit') }}</button>
        <button class="git-btn" :disabled="!git.canCommit" @click="commit(true)">{{ t('git.commitAndPush') }}</button>
      </div>
    </div>
  </section>
</template>
