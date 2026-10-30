import { watch } from 'vue';
import { usePandocExport } from '../../../composables/usePandocExport.ts';
import { useSettingsStore } from '../../../stores/settings.ts';
import type { CitationEntry } from '../../../lib/citations.ts';

export function useCitations(): () => CitationEntry[] {
  const settings = useSettingsStore();
  const pandoc = usePandocExport();
  let cached: CitationEntry[] = [];
  const load = (): void => {
    pandoc.loadCitations().then((c) => { cached = c; }).catch(() => {});
  };
  load();
  watch(
    () => settings.workspaceBibliography,
    () => {
      pandoc.invalidateCitationsCache();
      load();
    },
  );
  return () => cached;
}
