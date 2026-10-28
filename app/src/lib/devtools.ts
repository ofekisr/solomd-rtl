import { invoke } from '@tauri-apps/api/core';

const OPEN_ON_LOAD_KEY = 'solomd.openInspectorOnLoad';

export async function openInspector(): Promise<void> {
  await invoke('open_devtools');
}

/** sessionStorage survives `location.reload()`, so the flag reaches the
 *  freshly loaded page and nothing else. */
export function reloadWithInspector(): void {
  try {
    sessionStorage.setItem(OPEN_ON_LOAD_KEY, '1');
  } catch {
    // Storage blocked: reload anyway; the inspector just won't auto-open.
  }
  window.location.reload();
}

/** The dev app always opens the inspector; release builds only after "Reload with Web Inspector". */
export async function openInspectorIfRequested(): Promise<void> {
  try {
    if (import.meta.env.DEV) {
      await openInspector();
      return;
    }
    if (sessionStorage.getItem(OPEN_ON_LOAD_KEY) !== '1') return;
    sessionStorage.removeItem(OPEN_ON_LOAD_KEY);
    await openInspector();
  } catch {
    // Web build or a build without devtools: the browser's own F12 covers it.
  }
}
