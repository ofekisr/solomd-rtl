import { useGithubSyncStore } from '../../stores/githubSync';
import { useWorkspaceStore } from '../../stores/workspace';
import { useToastsStore } from '../../stores/toasts';
import { useI18n } from '../../i18n';

export function useGithubSyncToken(): { clearToken: () => Promise<void> } {
  const sync = useGithubSyncStore();
  const workspace = useWorkspaceStore();
  const toasts = useToastsStore();
  const { t } = useI18n();

  async function clearToken(): Promise<void> {
    if (sync.status?.linked && workspace.currentFolder) {
      await sync.unlink(workspace.currentFolder).catch(() => {});
    }
    await sync.clearToken();
    toasts.info(t('githubSync.tokenClearedToast'));
  }

  return { clearToken };
}
