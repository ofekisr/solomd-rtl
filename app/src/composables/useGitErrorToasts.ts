import { watch } from 'vue';
import { useGitPaneStore } from '../stores/gitPane';
import { useToastsStore } from '../stores/toasts';
import { formatGitErrorToast } from '../lib/git-pane/formatError';

const SILENT_CODES = new Set(['DirtyWorktree', 'Cancelled']);

export function useGitErrorToasts(): void {
  const git = useGitPaneStore();
  const toasts = useToastsStore();
  watch(
    () => git.lastError,
    (error) => {
      if (!error || git.status !== 'ready' || SILENT_CODES.has(error.code)) return;
      toasts.error(formatGitErrorToast(error));
    },
  );
}
