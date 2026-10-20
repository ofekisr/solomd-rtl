<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { decodeDiffPath } from '../../lib/git-pane/diffTab';
import { getGitPaneService } from '../../lib/git-pane/serviceFactory';
import type { DiffHunk, DiffResult } from '../../lib/git-pane/shared/models';
import { buildSplitRows, type SplitLineRow } from '../../lib/git-pane/diff/buildSplitRows';
import { highlightLine } from '../../lib/git-pane/diff/highlight';
import { renderInlineDiff, shouldInlineHighlight } from '../../lib/git-pane/diff/wordDiff';
import { buildPatchFromHunk } from '../../lib/git-pane/shared/buildPatch';
import { useGitPaneStore } from '../../stores/gitPane';
import { useI18n } from '../../i18n';

type ViewMode = 'split' | 'unified';
type PatchAction = 'stage-patch' | 'unstage-patch' | 'discard-patch';
type CellSide = 'left' | 'right';

interface HunkGroup {
  hunk: DiffHunk;
  rows: SplitLineRow[];
}

const props = defineProps<{ uri: string }>();
const git = useGitPaneStore();
const { t } = useI18n();
const diff = ref<DiffResult | null>(null);
const error = ref<string | null>(null);
const mode = ref<ViewMode>('split');

const target = computed(() => decodeDiffPath(props.uri));
const isWorktree = computed(() => target.value?.side === 'worktree');
const isIndex = computed(() => target.value?.side === 'index');
const language = computed(() => diff.value?.language ?? 'plaintext');

const groups = computed<HunkGroup[]>(() => {
  if (!diff.value) return [];
  const lineRows = buildSplitRows(diff.value.hunks).filter((r): r is SplitLineRow => r.kind === 'line');
  return diff.value.hunks.map((hunk, index) => ({
    hunk,
    rows: lineRows.filter((r) => r.hunkIndex === index),
  }));
});

async function load(): Promise<void> {
  const ref_ = target.value;
  if (!ref_) return;
  error.value = null;
  try {
    diff.value = await getGitPaneService().diff({ path: ref_.path, source: ref_.side, sha: ref_.sha });
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  }
}

async function hunkAction(hunk: DiffHunk, kind: PatchAction): Promise<void> {
  if (!diff.value) return;
  if (kind === 'discard-patch' && !window.confirm(t('git.confirmRollback', { name: diff.value.path }))) return;
  const patch = buildPatchFromHunk(diff.value.path, hunk, diff.value.oldPath);
  let isApplied = false;
  try {
    isApplied = await git.run({ kind, target: diff.value.path, meta: { patch } });
  } finally {
    if (!isApplied) await load();
  }
}

function html(content: string): string {
  return highlightLine(content, language.value);
}

function cellHtml(row: SplitLineRow, side: CellSide): string {
  const isPair = row.left.type === 'del' && row.right.type === 'add';
  if (isPair && shouldInlineHighlight(row.left.content, row.right.content)) {
    const inline = renderInlineDiff(row.left.content, row.right.content, language.value);
    return side === 'left' ? inline.oldHtml : inline.newHtml;
  }
  return html(row[side].content);
}

function cellClass(row: SplitLineRow, side: CellSide): string {
  const type = row[side].type;
  return type === 'empty' ? '' : `git-diff__line--${type}`;
}

onMounted(load);
watch(() => props.uri, load);
watch(() => git.snapshot, () => { if (target.value?.side !== 'commit') void load(); });
</script>

<template>
  <div class="git-diff">
    <div class="git-toolbar">
      <span class="git-diff__path" dir="auto">{{ target?.path }}</span>
      <button :aria-pressed="mode === 'split'" @click="mode = 'split'">{{ t('git.sideBySide') }}</button>
      <button :aria-pressed="mode === 'unified'" @click="mode = 'unified'">{{ t('git.unified') }}</button>
    </div>
    <div v-if="error" class="git-empty">{{ error }}</div>
    <div v-else-if="diff?.binary" class="git-empty">{{ t('git.binaryFile') }}</div>
    <div v-else-if="diff?.tooLarge" class="git-empty">{{ t('git.tooLarge') }}</div>
    <div v-else-if="diff" class="git-diff__body" dir="ltr">
      <template v-for="group in groups" :key="group.hunk.header">
        <div class="git-diff__hunk">
          <code>{{ group.hunk.header }}</code>
          <span class="git-diff__spacer" />
          <button v-if="isWorktree" @click="hunkAction(group.hunk, 'stage-patch')">{{ t('git.stageHunk') }}</button>
          <button v-if="isIndex" @click="hunkAction(group.hunk, 'unstage-patch')">{{ t('git.unstageHunk') }}</button>
          <button v-if="isWorktree" @click="hunkAction(group.hunk, 'discard-patch')">{{ t('git.rollbackHunk') }}</button>
        </div>
        <table v-if="mode === 'unified'" class="git-diff__table">
          <tr v-for="(line, i) in group.hunk.lines" :key="i" :class="`git-diff__line--${line.type}`">
            <td class="git-diff__num">{{ line.oldLine ?? '' }}</td>
            <td class="git-diff__num">{{ line.newLine ?? '' }}</td>
            <td class="git-diff__code"><span v-html="html(line.content)" /></td>
          </tr>
        </table>
        <table v-else class="git-diff__table git-diff__table--split">
          <tr v-for="row in group.rows" :key="row.key">
            <td class="git-diff__num">{{ row.left.lineNum ?? '' }}</td>
            <td class="git-diff__code" :class="cellClass(row, 'left')"><span v-html="cellHtml(row, 'left')" /></td>
            <td class="git-diff__num">{{ row.right.lineNum ?? '' }}</td>
            <td class="git-diff__code" :class="cellClass(row, 'right')"><span v-html="cellHtml(row, 'right')" /></td>
          </tr>
        </table>
      </template>
    </div>
  </div>
</template>
