import { windowPort } from '../../../platform/index.ts';
import { forceWinChromePreview, isMacOS, isWindowsDesktop } from '../../../lib/platform';

const INTERACTIVE_SELECTOR =
  'button, input, select, textarea, a, [contenteditable="true"], .dropdown__menu, [data-no-drag]';

function isInteractiveTitleBarTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  return !!node?.closest?.(INTERACTIVE_SELECTOR);
}

function hasTauriShell(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/**
 * v4.6 macOS unified title bar and the frameless Windows build (the toolbar
 * row hosts menubar + caption buttons). `?forceWinChrome` previews the Windows
 * layout in the macOS dev build. #127 — the window is dragged through
 * `startDragging()` because `data-tauri-drag-region` proved unreliable.
 */
export function useTitleBar() {
  const macTitleBar = isMacOS();
  const hasShell = hasTauriShell();
  const winTitleBar =
    (isWindowsDesktop() && hasShell) || (import.meta.env.DEV && forceWinChromePreview());
  const customTitleBar = macTitleBar || winTitleBar;

  function onTitleBarMouseDown(e: MouseEvent): void {
    if (!customTitleBar || e.button !== 0 || e.detail > 1) return;
    if (isInteractiveTitleBarTarget(e.target)) return;
    if (!('__TAURI_INTERNALS__' in window)) return;
    void windowPort.currentWindow().startDragging();
  }

  function onTitleBarDblClick(e: MouseEvent): void {
    if (!customTitleBar) return;
    if (isInteractiveTitleBarTarget(e.target)) return;
    if (!('__TAURI_INTERNALS__' in window)) return;
    void windowPort.currentWindow().toggleMaximize();
  }

  return { macTitleBar, winTitleBar, customTitleBar, hasTauriShell: hasShell, onTitleBarMouseDown, onTitleBarDblClick };
}
