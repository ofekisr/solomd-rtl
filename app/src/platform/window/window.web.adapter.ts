import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import type { PlatformWebviewWindow, WindowEvent, WindowPort } from './window.port.ts';
import type { UnlistenFn } from '../events/events.port.ts';

const WEBVIEW_ERROR_EVENT = 'tauri://error';
const WEBVIEW_OPERATION = 'webviewWindow.WebviewWindow';

type WindowHandler = (event: WindowEvent) => void;

function unsupportedAsync(operation: string): () => Promise<never> {
  return () => Promise.reject(new PlatformUnsupportedError(operation));
}

function unsupportedSync(operation: string): () => never {
  return () => {
    throw new PlatformUnsupportedError(operation);
  };
}

function createUnavailableWebviewWindow(): PlatformWebviewWindow {
  const listeners = new Map<string, Set<WindowHandler>>();
  const error = new PlatformUnsupportedError(WEBVIEW_OPERATION);
  queueMicrotask(() => {
    const handlers = [...(listeners.get(WEBVIEW_ERROR_EVENT) ?? [])];
    listeners.delete(WEBVIEW_ERROR_EVENT);
    handlers.forEach((handler) => handler({ payload: error }));
  });
  return {
    async once(event: string, handler: WindowHandler): Promise<UnlistenFn> {
      const handlers = listeners.get(event) ?? new Set<WindowHandler>();
      handlers.add(handler);
      listeners.set(event, handlers);
      return () => {
        handlers.delete(handler);
      };
    },
  };
}

export function createWebWindowPort(): WindowPort {
  return {
    currentWindow: unsupportedSync('window.getCurrentWindow'),
    currentWebview: unsupportedSync('webview.getCurrentWebview'),
    createWebviewWindow: createUnavailableWebviewWindow,
    getVersion: unsupportedAsync('app.getVersion'),
    deepLink: {
      onOpenUrl: unsupportedAsync('deep-link.onOpenUrl'),
      getCurrent: unsupportedAsync('deep-link.getCurrent'),
    },
  };
}
