import { computed, type ComputedRef } from 'vue';
import { useI18n } from '../../../i18n';
import { completionSettingsStatus, directiveCompletionStatus } from '../../../lib/directive-completion-registry';
import { settingsPort } from '../../../platform/index.ts';
import { useToastsStore } from '../../../stores/toasts';

type CompletionWarnings = ReturnType<typeof directiveCompletionStatus>['warnings'];

export interface DirectiveStatus {
  completionStatusText: ComputedRef<string>;
  completionWarnings: CompletionWarnings;
  openCompletionsFolder: () => Promise<void>;
}

export function useDirectiveStatus(): DirectiveStatus {
  const { t } = useI18n();
  const toasts = useToastsStore();
  const status = directiveCompletionStatus();
  const counts = completionSettingsStatus(status);
  const completionStatusText = computed(() => t('settings.directiveCompletionLoaded', { count: counts.loaded }));

  async function openCompletionsFolder(): Promise<void> {
    try {
      await settingsPort.directiveCompletionsOpenFolder();
    } catch (error: unknown) {
      toasts.error(t('settings.directiveCompletionOpenFailed', { error: String(error) }));
    }
  }
  return { completionStatusText, completionWarnings: status.warnings, openCompletionsFolder };
}
