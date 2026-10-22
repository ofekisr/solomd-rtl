import { onBeforeUnmount, watch } from 'vue';
import { useTabsStore } from '../stores/tabs';
import { useSettingsStore } from '../stores/settings';
import { canAutoSave } from '../lib/auto-save';
import { isFileConflictPending } from './useFileWatcher';
import type { Tab } from '../types';

type SaveTab = (tab: Tab, opts: { silent?: boolean }) => Promise<boolean>;

export function useAutoSave(saveTab: SaveTab) {
  const tabs = useTabsStore();
  const settings = useSettingsStore();
  const timers = new Map<string, number>();

  function cancel(tabId: string): void {
    const timer = timers.get(tabId);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.delete(tabId);
  }

  function isSavable(tab: Tab): boolean {
    return canAutoSave(tab, !!tab.filePath && isFileConflictPending(tab.filePath));
  }

  async function flush(tabId: string): Promise<void> {
    timers.delete(tabId);
    const tab = tabs.tabs.find((t) => t.id === tabId);
    if (!settings.autoSaveAfterDelay || !tab || !isSavable(tab)) return;
    await saveTab(tab, { silent: true });
  }

  function schedule(tab: Tab): void {
    cancel(tab.id);
    if (!settings.autoSaveAfterDelay || !isSavable(tab)) return;
    timers.set(tab.id, window.setTimeout(() => void flush(tab.id), settings.autoSaveDelayMs));
  }

  watch(
    () => tabs.tabs.map((t) => [t.id, t.content] as const),
    (next, previous) => {
      const before = new Map(previous ?? []);
      for (const [id, content] of next) {
        if (before.get(id) === content) continue;
        const tab = tabs.tabs.find((t) => t.id === id);
        if (tab) schedule(tab);
      }
    },
  );

  watch(() => settings.autoSaveAfterDelay, (isOn) => {
    if (isOn) return;
    for (const id of [...timers.keys()]) cancel(id);
  });

  onBeforeUnmount(() => {
    for (const id of [...timers.keys()]) cancel(id);
  });
}
