import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';
import { categoryOf, defaultPage, parsePageKey, type PageKey, type SettingsCategory } from '../../../lib/settings-nav';
import type { SettingsPanelProps } from './settings-panel-props.ts';

export interface SettingsNavigation {
  activePage: Ref<PageKey>;
  activeCategory: ComputedRef<SettingsCategory>;
  openPage: (key: PageKey) => void;
}

/**
 * Callers (toolbar AI button, RAG empty state, …) pass `initial-section` to
 * land on a specific category instead of `basics`. The watch fires on the
 * open transition rather than on the section value, because the parent leaves
 * the section ref in place after close — re-opening would otherwise jump back
 * to the same anchor.
 */
export function useSettingsNavigation(
  props: SettingsPanelProps,
  bodyEl: Ref<HTMLElement | null>,
  searchQuery: Ref<string>,
): SettingsNavigation {
  const activePage = ref<PageKey>(defaultPage('basics'));
  const activeCategory = computed<SettingsCategory>(() => categoryOf(activePage.value));

  /** #144 — every page shares the single scrolling `.settings__body`, so reset its scrollTop on each page switch. */
  watch(activePage, () => {
    bodyEl.value?.scrollTo({ top: 0 });
  });

  watch(
    () => props.open,
    (isOpen) => {
      if (!isOpen) return;
      const target = parsePageKey(props.initialSection);
      if (target) activePage.value = target;
    },
  );

  function openPage(key: PageKey): void {
    searchQuery.value = '';
    activePage.value = key;
  }

  return { activePage, activeCategory, openPage };
}
