import { IS_APP_STORE_BUILD } from '../../../lib/app-build';
import { isMasBuild } from '../../../lib/check-update';
import { hasGitBackend, isIOS, isMobile, isWindowsEditorRuntime } from '../../../lib/platform';

export interface SettingsEnv {
  isMobilePlatform: boolean;
  isPhoneOrTablet: boolean;
  masBuild: boolean;
  gitBackend: boolean;
  windowsEditorRuntime: boolean;
  isAppStoreBuild: boolean;
}

/**
 * Quick capture needs an OS-level hotkey and a second window — neither exists
 * on Android or iOS, so `isPhoneOrTablet` (not `isMobilePlatform`, which is
 * iOS only) hides it on phones. `gitBackend` is false on Android (#230): the
 * git-backed panels are compiled out there and only produced
 * `Command … not found` errors. `windowsEditorRuntime` marks the two-editor
 * case (#328/#344), i.e. Windows and the ?forcePlain dev hook.
 */
export function useSettingsEnv(): SettingsEnv {
  return {
    isMobilePlatform: isIOS(),
    isPhoneOrTablet: isMobile(),
    masBuild: isMasBuild(),
    gitBackend: hasGitBackend(),
    windowsEditorRuntime: isWindowsEditorRuntime(),
    isAppStoreBuild: IS_APP_STORE_BUILD,
  };
}
