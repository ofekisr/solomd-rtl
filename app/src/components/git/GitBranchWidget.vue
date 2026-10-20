<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { useGitPaneStore } from '../../stores/gitPane';
import { useI18n } from '../../i18n';
import { promptText } from '../../composables/useGitPrompt';

const RECENT_LIMIT = 5;

const git = useGitPaneStore();
const { t } = useI18n();
const isOpen = ref(false);
const query = ref('');
const searchEl = ref<HTMLInputElement | null>(null);

const locals = computed(() => (git.snapshot?.branches ?? []).filter((b) => b.kind === 'local'));
const recent = computed(() => [...locals.value].sort((a, b) => b.lastActivity.localeCompare(a.lastActivity)).slice(0, RECENT_LIMIT));
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  return q ? locals.value.filter((b) => b.name.toLowerCase().includes(q)) : locals.value;
});

function toggle(): void {
  isOpen.value = !isOpen.value;
  query.value = '';
  if (isOpen.value) void nextTick(() => searchEl.value?.focus());
}

function checkout(name: string): void {
  isOpen.value = false;
  window.dispatchEvent(new CustomEvent('gitpane:checkout', { detail: { name } }));
}

async function newBranch(): Promise<void> {
  isOpen.value = false;
  const name = await promptText({ title: t('git.newBranch'), placeholder: t('git.branchNamePrompt') });
  if (name?.trim()) await git.run({ kind: 'create-branch', meta: { name: name.trim() } });
}

function push(): void {
  isOpen.value = false;
  window.dispatchEvent(new CustomEvent('gitpane:open-push'));
}

async function run(kind: 'pull' | 'fetch'): Promise<void> {
  isOpen.value = false;
  await git.run({ kind });
}
</script>

<template>
  <span v-if="git.status === 'ready'" class="git-branch-widget" @keydown.esc.stop="isOpen = false">
    <button class="git-branch-widget__btn" :aria-expanded="isOpen" aria-haspopup="menu" @click="toggle">
      ⎇ <span dir="auto">{{ git.currentBranch }}</span>
      <span v-if="git.aheadBehind.ahead">↑{{ git.aheadBehind.ahead }}</span>
      <span v-if="git.aheadBehind.behind">↓{{ git.aheadBehind.behind }}</span>
    </button>
    <template v-if="isOpen">
      <div class="git-popup__scrim" @click="isOpen = false" />
      <div class="git-popup" role="menu">
        <input ref="searchEl" v-model="query" class="git-search" :placeholder="t('git.searchBranches')" />
        <button class="git-popup__item" role="menuitem" @click="newBranch">{{ t('git.newBranch') }}</button>
        <button class="git-popup__item" role="menuitem" @click="run('pull')">{{ t('git.updateProject') }}</button>
        <button class="git-popup__item" role="menuitem" @click="push">{{ t('git.push') }}…</button>
        <button class="git-popup__item" role="menuitem" @click="run('fetch')">{{ t('git.fetch') }}</button>
        <div v-if="!query" class="git-group-title">{{ t('git.recentBranches') }}</div>
        <button v-for="b in (query ? filtered : recent)" :key="b.id" class="git-popup__item" :class="{ 'git-row--current': b.isCurrent }" role="menuitem" dir="auto" @click="checkout(b.name)">{{ b.name }}</button>
        <template v-if="!query">
          <div class="git-group-title">{{ t('git.localBranches') }}</div>
          <button v-for="b in locals" :key="`l${b.id}`" class="git-popup__item" :class="{ 'git-row--current': b.isCurrent }" role="menuitem" dir="auto" @click="checkout(b.name)">{{ b.name }}</button>
        </template>
      </div>
    </template>
  </span>
</template>
