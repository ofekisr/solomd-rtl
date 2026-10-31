import { watch } from 'vue';
import { useThemeStore } from '../../stores/theme';

export function useThemePaint(): void {
  const themeStore = useThemeStore();
  watch(() => themeStore.resolved, () => themeStore.paint(), { immediate: true });
  void themeStore.init();
}
