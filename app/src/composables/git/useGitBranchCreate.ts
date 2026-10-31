import { useGitPaneStore } from '../../stores/gitPane';
import { useI18n } from '../../i18n';
import { promptText } from './useGitPrompt';

export function useGitBranchCreate() {
  const git = useGitPaneStore();
  const { t } = useI18n();

  async function createBranchFrom(startPoint: string): Promise<void> {
    const name = await promptText({ title: t('git.newBranchFromHere'), placeholder: t('git.branchNamePrompt') });
    if (name) await git.run({ kind: 'create-branch', meta: { name, startPoint } });
  }

  return { createBranchFrom };
}
