import { nextTick, onUnmounted, watch, type Ref } from 'vue';
import { clearHighlight } from './useSettingsSearch.ts';
import type { SettingsPanelProps } from './settings-panel-props.ts';

/**
 * Esc clears a query before it closes the dialog, and ⌘F / Ctrl+F jumps to
 * the search box. Window capture runs before DsModal's document-capture
 * Escape handler (and the app's global shortcuts).
 */
export function useSearchShortcuts(
  props: SettingsPanelProps,
  searchQuery: Ref<string>,
  searchInput: Ref<HTMLInputElement | null>,
): void {
  function onSearchKeys(e: KeyboardEvent): void {
    if (!props.open) return;
    if (e.key === 'Escape' && searchQuery.value) {
      e.preventDefault();
      e.stopImmediatePropagation();
      searchQuery.value = '';
      searchInput.value?.focus();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      e.stopImmediatePropagation();
      searchInput.value?.focus();
      searchInput.value?.select();
    }
  }

  watch(
    () => props.open,
    async (open) => {
      if (open) {
        window.addEventListener('keydown', onSearchKeys, true);
        // DsModal focuses the first control, which is now the search box. On a
        // phone that would raise the keyboard over a dialog the user opened to
        // browse, so give the focus back there.
        await nextTick();
        setTimeout(() => {
          if (document.documentElement.classList.contains('narrow-viewport')) searchInput.value?.blur();
        }, 0);
      } else {
        window.removeEventListener('keydown', onSearchKeys, true);
        searchQuery.value = '';
        clearHighlight();
      }
    },
    { immediate: true },
  );
  onUnmounted(() => window.removeEventListener('keydown', onSearchKeys, true));
}
