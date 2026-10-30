import { RangeSetBuilder, type Text } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';
import { mountReadOnlyMindmap, type ReadOnlyMindmap, type ReadOnlyMountResult } from '../mindmap-readonly.ts';
import { findMindmapFences, MINDMAP_OPEN_EVENT, type MindmapFence, type MindmapOpenDetail } from '../mindmap-fence.ts';
import { isLineWithin } from './layout.ts';
import { type BlockOptions } from './options.ts';

export interface MindmapStrings { openFull: string; parseError: string; gateBroken: string }
export interface MindmapMountState { isDestroyed: boolean; map: ReadOnlyMindmap | null }

export const MINDMAP_FALLBACK_STRINGS: MindmapStrings = { openFull: 'Open fullscreen', parseError: 'Mind map could not be read', gateBroken: '⚠ missing target' };
export const CM_RELAYOUT_EVENT = 'solomd:cm-relayout';
export const mindmapTeardowns = new WeakMap<HTMLElement, () => void>();

export function teardownMindmap(state: MindmapMountState): void {
  state.isDestroyed = true;
  state.map?.destroy();
  state.map = null;
}

export class MindmapWidget extends WidgetType {
  constructor(
    private readonly body: string,
    private readonly line: number,
    private readonly isDark: boolean,
    private readonly opts: BlockOptions,
  ) {
    super();
  }

  eq(other: MindmapWidget): boolean {
    return other.body === this.body && other.line === this.line && other.isDark === this.isDark;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-live-block cm-live-block--mindmap';
    const canvas = document.createElement('div');
    wrap.append(canvas, this.openButton());
    const state: MindmapMountState = { isDestroyed: false, map: null };
    mindmapTeardowns.set(wrap, () => teardownMindmap(state));
    void this.mount(wrap, canvas, state);
    return wrap;
  }

  private strings(): MindmapStrings {
    return this.opts.getMindmapStrings?.() ?? MINDMAP_FALLBACK_STRINGS;
  }

  private openButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cm-mindmap-open';
    button.textContent = this.strings().openFull;
    button.addEventListener('click', () => this.open());
    return button;
  }

  private open(): void {
    const tabId = this.opts.getTabId?.();
    if (!tabId) return;
    const detail: MindmapOpenDetail = { tabId, line: this.line, body: this.body };
    window.dispatchEvent(new CustomEvent(MINDMAP_OPEN_EVENT, { detail }));
  }

  private async load(canvas: HTMLElement): Promise<ReadOnlyMountResult> {
    try {
      return await mountReadOnlyMindmap(canvas, this.body, this.isDark, this.strings().gateBroken);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async mount(wrap: HTMLElement, canvas: HTMLElement, state: MindmapMountState): Promise<void> {
    const result = await this.load(canvas);
    if (state.isDestroyed) {
      if (result.ok) result.map.destroy();
      return;
    }
    if (result.ok) {
      state.map = result.map;
      window.dispatchEvent(new CustomEvent(CM_RELAYOUT_EVENT));
      return;
    }
    wrap.classList.add('cm-live-block--broken');
    wrap.textContent = `${this.strings().parseError}: ${result.error}`;
  }

  destroy(dom: HTMLElement): void {
    mindmapTeardowns.get(dom)?.();
    mindmapTeardowns.delete(dom);
  }

  ignoreEvent(): boolean {
    return true;
  }
}

export interface MindmapBuildContext {
  doc: Text;
  cursorLine: number;
  cursorLineEnd: number;
  keepSource: boolean;
  opts: BlockOptions;
}

export const mindmapFenceCache = new WeakMap<Text, Map<number, MindmapFence>>();

export function mindmapFencesByCmLine(doc: Text): Map<number, MindmapFence> {
  const cached = mindmapFenceCache.get(doc);
  if (cached) return cached;
  const byLine = new Map(findMindmapFences(doc.toString()).map((fence) => [fence.line + 1, fence] as const));
  mindmapFenceCache.set(doc, byLine);
  return byLine;
}

export function addMindmapDecoration(builder: RangeSetBuilder<Decoration>, fence: MindmapFence, ctx: MindmapBuildContext): number {
  const startLine = fence.line + 1;
  const endLine = ctx.doc.lineAt(fence.to).number;
  const isRevealed = ctx.keepSource
    || isLineWithin(ctx.cursorLine, startLine, endLine)
    || isLineWithin(ctx.cursorLineEnd, startLine, endLine);
  if (!isRevealed) {
    const isDark = ctx.opts.getMermaidTheme?.() === 'dark';
    builder.add(ctx.doc.line(startLine).from, ctx.doc.line(endLine).to, Decoration.replace({
      widget: new MindmapWidget(fence.body, fence.line, isDark, ctx.opts),
      block: true,
    }));
  }
  return endLine + 1;
}
