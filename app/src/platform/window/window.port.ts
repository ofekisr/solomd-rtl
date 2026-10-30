export type UnlistenFn = () => void;

export interface PlatformEvent<T = unknown> {
  payload: T;
}

export type DragDropPayload =
  | { type: 'enter'; paths: string[]; position: { x: number; y: number } }
  | { type: 'over'; position: { x: number; y: number } }
  | { type: 'drop'; paths: string[]; position: { x: number; y: number } }
  | { type: 'leave' };

export interface WebviewWindowOptions {
  url?: string;
  title?: string;
  width?: number;
  height?: number;
  decorations?: boolean;
  resizable?: boolean;
}

export interface PlatformWindow {
  readonly label: string;
  setTitle(title: string): Promise<void>;
  close(): Promise<void>;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  isMaximized(): Promise<boolean>;
  isFullscreen(): Promise<boolean>;
  setFullscreen(fullscreen: boolean): Promise<void>;
  startDragging(): Promise<void>;
  onResized(handler: (event: PlatformEvent) => void): Promise<UnlistenFn>;
}

export interface PlatformWebview {
  setZoom(factor: number): Promise<void>;
  onDragDropEvent(handler: (event: PlatformEvent<DragDropPayload>) => void | Promise<void>): Promise<UnlistenFn>;
}

export interface PlatformWebviewWindow {
  once(event: string, handler: (event: PlatformEvent) => void): Promise<UnlistenFn>;
}

export interface DeepLinkPort {
  onOpenUrl(handler: (urls: string[]) => void): Promise<UnlistenFn>;
  getCurrent(): Promise<string[] | null>;
}

export interface WindowPort {
  currentWindow(): PlatformWindow;
  currentWebview(): PlatformWebview;
  createWebviewWindow(label: string, options: WebviewWindowOptions): PlatformWebviewWindow;
  getVersion(): Promise<string>;
  deepLink: DeepLinkPort;
}
