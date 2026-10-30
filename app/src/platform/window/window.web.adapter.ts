import { PlatformUnsupportedError } from '../ipc/command.port.ts';
import type { WindowPort } from './window.port.ts';

function unsupportedAsync(operation: string): () => Promise<never> {
  return () => Promise.reject(new PlatformUnsupportedError(operation));
}

function unsupportedSync(operation: string): () => never {
  return () => {
    throw new PlatformUnsupportedError(operation);
  };
}

export function createWebWindowPort(): WindowPort {
  return {
    currentWindow: unsupportedSync('window.getCurrentWindow'),
    currentWebview: unsupportedSync('webview.getCurrentWebview'),
    createWebviewWindow: unsupportedSync('webviewWindow.WebviewWindow'),
    getVersion: unsupportedAsync('app.getVersion'),
    deepLink: {
      onOpenUrl: unsupportedAsync('deep-link.onOpenUrl'),
      getCurrent: unsupportedAsync('deep-link.getCurrent'),
    },
  };
}
