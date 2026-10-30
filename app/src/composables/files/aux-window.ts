import { windowPort } from '../../platform/index.ts';
import { isWindowsDesktop } from '../../lib/platform';
import type { FilesCtx } from './files-ctx.ts';

export function createAuxWindowSpawner(ctx: FilesCtx) {
  const { workspace, windowsStore } = ctx;

  // #103 — spawn an auxiliary window with a *stable* label (`solomd-window-N`)
  // instead of a timestamp, and record it in the shared windows registry so
  // (a) tauri-plugin-window-state can restore its geometry by label and
  // (b) the main window re-spawns it on the next launch. Returns the label,
  // or null when window creation failed (caller falls back to in-tab open).
  function spawnAuxWindow(path: string): string | null {
    try {
      const label = windowsStore.nextAuxLabel();
      const url = `/?path=${encodeURIComponent(path)}`;
      // Windows ships frameless (unified title bar; tauri.windows.conf.json
      // only covers the main window) — aux windows must match or they'd get
      // native chrome PLUS the in-app caption buttons Toolbar.vue renders.
      windowPort.createWebviewWindow(label, {
        url,
        title: 'SoloMD',
        width: 1000,
        height: 700,
        decorations: !isWindowsDesktop(),
      });
      windowsStore.register(label, { path, folder: workspace.currentFolder });
      return label;
    } catch (e) {
      console.warn('aux-window spawn failed', e);
      return null;
    }
  }

  return spawnAuxWindow;
}
