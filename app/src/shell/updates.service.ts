import { isIOS } from '../lib/platform.ts';

const UPDATE_TOAST_TIMEOUT_MS = 12000;
const UPDATE_AVAILABLE_KEY = 'settings.updateAvailable';

export interface UpdateCheckResult {
  hasUpdate: boolean;
  latest: string | null;
  url: string;
}

export interface UpdatesDeps {
  isAutoCheckEnabled(): boolean;
  checkForUpdateOnStartup(): Promise<UpdateCheckResult | null>;
  openReleaseUrl(url: string): Promise<unknown>;
  showToast(message: string, timeoutMs: number, onClick: () => void): void | Promise<void>;
  t(key: string, params?: Record<string, string>): string;
}

export interface UpdatesService {
  start(): Promise<void>;
}

export function createUpdatesService(deps: UpdatesDeps): UpdatesService {
  async function start(): Promise<void> {
    if (isIOS() || !deps.isAutoCheckEnabled()) return;
    try {
      const result = await deps.checkForUpdateOnStartup();
      if (result && result.hasUpdate) await announce(result);
    } catch {
      return;
    }
  }

  async function announce(result: UpdateCheckResult): Promise<void> {
    const message = deps.t(UPDATE_AVAILABLE_KEY, { version: result.latest || '' });
    await deps.showToast(message, UPDATE_TOAST_TIMEOUT_MS, () => {
      void deps.openReleaseUrl(result.url);
    });
  }

  return { start };
}
