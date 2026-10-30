export interface ActiveDocument {
  content: string;
  baseName: string;
  filePath?: string;
}

export function iosSavedToast(filename: string): string {
  return `Saved to On My iPhone › SoloMD › ${filename}`;
}

// Modern Clipboard API works on all desktops and on iOS 16+ WKWebView,
// and supports rich types (HTML, PNG) — unlike Tauri's plugin-clipboard-
// manager iOS implementation which only ships `writeText`.
export function hasNativeClipboardWrite(): boolean {
  return typeof navigator !== 'undefined'
    && typeof navigator.clipboard !== 'undefined'
    && typeof navigator.clipboard.write === 'function'
    && typeof (window as unknown as { ClipboardItem?: unknown }).ClipboardItem !== 'undefined';
}
