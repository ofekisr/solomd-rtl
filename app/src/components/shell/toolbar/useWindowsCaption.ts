import { onBeforeUnmount, onMounted, ref, type InjectionKey } from 'vue';
import { eventsPort, windowCommandsPort, windowPort, type UnlistenFn } from '../../../platform/index.ts';
import { isWindowsDesktop } from '../../../lib/platform';

const ZERO_RECT = { x: 0, y: 0, w: 0, h: 0 };

export function useWindowsCaption(winTitleBar: boolean, hasTauriShell: boolean) {
  const isMaximized = ref(false);
  const maxBtnHover = ref(false);
  const maxBtnRef = ref<HTMLElement | null>(null);
  let unlistenWinChrome: UnlistenFn[] = [];
  let rectRaf = 0;

  function winMinimize(): void {
    if (hasTauriShell) void windowPort.currentWindow().minimize();
  }
  /** Fallback only: on the real Windows main window the Rust subclass claims this button. */
  function winToggleMax(): void {
    if (hasTauriShell) void windowPort.currentWindow().toggleMaximize();
  }
  /** Routes through Tauri's close-requested flow, so the unsaved-tabs confirm runs. */
  function winClose(): void {
    if (hasTauriShell) void windowPort.currentWindow().close();
  }

  async function refreshMaximized(): Promise<void> {
    if (!hasTauriShell) return;
    try {
      isMaximized.value = await windowPort.currentWindow().isMaximized();
    } catch {
      /* not fatal */
    }
  }

  /** Reports the maximize button's rect so the Rust WM_NCHITTEST subclass can answer HTMAXBUTTON. */
  function reportMaxBtnRect(): void {
    if (!winTitleBar || !hasTauriShell || !isWindowsDesktop()) return;
    if (windowPort.currentWindow().label !== 'main') return;
    cancelAnimationFrame(rectRaf);
    rectRaf = requestAnimationFrame(() => {
      const scale = window.devicePixelRatio || 1;
      const r = maxBtnRef.value?.getBoundingClientRect();
      void windowCommandsPort.setMaxButtonRect(
        r && r.width > 0
          ? { x: r.left, y: r.top, w: r.width, h: r.height, scale }
          : { ...ZERO_RECT, scale },
      );
    });
  }

  async function listenWindowChrome(): Promise<void> {
    try {
      unlistenWinChrome.push(
        await windowPort.currentWindow().onResized(() => {
          void refreshMaximized();
          reportMaxBtnRect();
        }),
      );
      unlistenWinChrome.push(
        await eventsPort.listen<boolean>('solomd://maxbtn-hover', (e) => {
          maxBtnHover.value = !!e.payload;
        }),
      );
    } catch {
      /* browser dev preview — no Tauri events */
    }
  }

  onMounted(async () => {
    if (!winTitleBar || !hasTauriShell) return;
    await refreshMaximized();
    reportMaxBtnRect();
    window.addEventListener('resize', reportMaxBtnRect);
    await listenWindowChrome();
  });
  onBeforeUnmount(() => {
    if (!winTitleBar) return;
    window.removeEventListener('resize', reportMaxBtnRect);
    for (const un of unlistenWinChrome) un();
    unlistenWinChrome = [];
    if (hasTauriShell && isWindowsDesktop()) {
      void windowCommandsPort.setMaxButtonRect({ ...ZERO_RECT, scale: 1 });
    }
  });

  return { isMaximized, maxBtnHover, maxBtnRef, winMinimize, winToggleMax, winClose };
}

export type WindowsCaption = ReturnType<typeof useWindowsCaption>;
export const WINDOWS_CAPTION: InjectionKey<WindowsCaption> = Symbol('windows-caption');
