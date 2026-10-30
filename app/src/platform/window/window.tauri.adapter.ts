import { getVersion } from '@tauri-apps/api/app';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type {
  DeepLinkPort,
  PlatformWebview,
  PlatformWebviewWindow,
  PlatformWindow,
  WebviewWindowOptions,
  WindowPort,
} from './window.port.ts';

export interface DeepLinkModule extends DeepLinkPort {}

export interface TauriWindowModules {
  getCurrentWindow: () => PlatformWindow;
  getCurrentWebview: () => PlatformWebview;
  createWebviewWindow: (label: string, options: WebviewWindowOptions) => PlatformWebviewWindow;
  getVersion: () => Promise<string>;
  loadDeepLink: () => Promise<DeepLinkModule>;
}

const realModules: TauriWindowModules = {
  getCurrentWindow,
  getCurrentWebview,
  createWebviewWindow: (label, options) => new WebviewWindow(label, options),
  getVersion,
  loadDeepLink: () => import('@tauri-apps/plugin-deep-link'),
};

export function createTauriWindowPort(mod: TauriWindowModules = realModules): WindowPort {
  return {
    currentWindow: () => mod.getCurrentWindow(),
    currentWebview: () => mod.getCurrentWebview(),
    createWebviewWindow: (label, options) => mod.createWebviewWindow(label, options),
    getVersion: () => mod.getVersion(),
    deepLink: {
      onOpenUrl: async (handler) => (await mod.loadDeepLink()).onOpenUrl(handler),
      getCurrent: async () => (await mod.loadDeepLink()).getCurrent(),
    },
  };
}
