import type { MindElixirInstance } from 'mind-elixir';
import type { MapDisplay } from './mindmap-display.ts';
import type { Snippet } from './mindmap-snippets.ts';

export interface MindmapHandle { run(actionId: string): boolean }

export interface MindmapCanvasApi {
  flush(): void;
  run(actionId: string): boolean;
  getMind(): MindElixirInstance | null;
  getDisplayOverride(): MapDisplay;
  setDisplayOverride(next: MapDisplay): void;
  getSnippets(): Snippet[];
  setSnippets(next: readonly Snippet[]): void;
  readonly isReadOnly: boolean;
  readonly isGraphView: boolean;
  readonly hasMap: boolean;
}

let active: MindmapHandle | null = null;

export function setActiveMindmap(handle: MindmapHandle): void {
  active = handle;
}

export function clearActiveMindmap(handle: MindmapHandle): void {
  if (active === handle) active = null;
}

export function runActiveMindmapAction(actionId: string): boolean {
  return active?.run(actionId) ?? false;
}
