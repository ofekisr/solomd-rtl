import { watch } from 'vue';
import { useGitPaneStore } from '../stores/gitPane';
import { useToastsStore } from '../stores/toasts';
import { formatGitErrorToast, isSilentGitError } from '../lib/git-pane/formatError';

export function useGitErrorToasts(): void {
  const git = useGitPaneStore();
  const toasts = useToastsStore();
  watch(
    () => git.lastError,
    (error) => {
      if (!error || git.status !== 'ready' || isSilentGitError(error.code, git.lastErrorKind)) return;
      toasts.error(formatGitErrorToast(error));
    },
  );
}
