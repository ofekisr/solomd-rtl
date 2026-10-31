import { ref } from 'vue';
import type { MindElixirInstance } from 'mind-elixir';
import { findDuplicateGroups, mergeIntoGate, type DuplicateGroup } from '../../lib/mindmap/duplicates';
import { findNode } from '../../lib/mindmap/gates';
import { fullRoot } from './useMindmapCanvasFocus.ts';

const DUPLICATE_COUNT_DEBOUNCE_MS = 500;

export interface DuplicatesDeps {
  getMind(): MindElixirInstance | null;
  isEditBlocked(): boolean;
  leaveFocusQuietly(): void;
  reapplyFocus(): void;
  syncLabels(): void;
  scheduleSync(): void;
}

export function useMindmapCanvasDuplicates(deps: DuplicatesDeps) {
  const duplicateCount = ref(0);
  const duplicateGroups = ref<DuplicateGroup[] | null>(null);
  let duplicateTimer: number | null = null;

  function countDuplicates(): void {
    duplicateTimer = null;
    const mind = deps.getMind();
    duplicateCount.value = mind ? findDuplicateGroups(fullRoot(mind)).length : 0;
  }

  function scheduleDuplicateCount(): void {
    if (duplicateTimer !== null) window.clearTimeout(duplicateTimer);
    duplicateTimer = window.setTimeout(countDuplicates, DUPLICATE_COUNT_DEBOUNCE_MS);
  }

  function resetDuplicateCount(): void {
    if (duplicateTimer !== null) window.clearTimeout(duplicateTimer);
    duplicateTimer = null;
    duplicateCount.value = 0;
  }

  function findDuplicates(): void {
    const mind = deps.getMind();
    if (mind) duplicateGroups.value = findDuplicateGroups(fullRoot(mind));
  }

  function topicOf(id: string): string {
    const mind = deps.getMind();
    return (mind && findNode(fullRoot(mind), id)?.topic) ?? '';
  }

  function mergeDuplicate(keepId: string, dupId: string): void {
    const mind = deps.getMind();
    if (!mind || deps.isEditBlocked()) return;
    const merged = mergeIntoGate(mind.getData(), keepId, dupId);
    if (!merged) return;
    deps.leaveFocusQuietly();
    mind.refresh(merged);
    mind.clearHistory?.();
    deps.syncLabels();
    deps.reapplyFocus();
    deps.scheduleSync();
    findDuplicates();
    countDuplicates();
  }

  return { duplicateCount, duplicateGroups, countDuplicates, scheduleDuplicateCount, resetDuplicateCount, findDuplicates, topicOf, mergeDuplicate };
}
