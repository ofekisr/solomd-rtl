import { ref, type Ref } from 'vue';
import { useI18n } from '../../../i18n';
import { checkForUpdate, openReleaseUrl } from '../../../lib/check-update';
import { settingsPort } from '../../../platform/index.ts';
import { useToastsStore } from '../../../stores/toasts';

export interface UpdateCheck {
  checkingUpdate: Ref<boolean>;
  manualCheckUpdate: () => Promise<void>;
  settingDefault: Ref<boolean>;
  setAsDefault: () => Promise<void>;
}

export function useUpdateCheck(): UpdateCheck {
  const { t } = useI18n();
  const toasts = useToastsStore();
  const checkingUpdate = ref(false);
  const settingDefault = ref(false);

  async function manualCheckUpdate(): Promise<void> {
    checkingUpdate.value = true;
    try {
      const r = await checkForUpdate();
      if (r.error) {
        toasts.error(t('settings.updateCheckFailed'));
      } else if (r.hasUpdate) {
        toasts.success(t('settings.updateAvailable', { version: r.latest || '' }));
        await openReleaseUrl(r.url);
      } else {
        toasts.info(t('settings.upToDate'));
      }
    } catch (e) {
      toasts.error(String(e));
    } finally {
      checkingUpdate.value = false;
    }
  }

  async function setAsDefault(): Promise<void> {
    settingDefault.value = true;
    try {
      toasts.success(await settingsPort.setAsDefaultMarkdownEditor());
    } catch (e) {
      toasts.error(String(e));
    } finally {
      settingDefault.value = false;
    }
  }
  return { checkingUpdate, manualCheckUpdate, settingDefault, setAsDefault };
}
