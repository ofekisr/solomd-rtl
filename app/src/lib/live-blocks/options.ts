import { type BoardThemeTokens } from '../tldraw-board.ts';

export interface BlockOptions {
  /** Workspace context for resolving relative image paths. */
  getImageRoot?: () => string | null;
  /** Active note's filesystem path so relative paths resolve to its dir. */
  getFilePath?: () => string | undefined;
  /** Theme/locale tokens handed to a mounted tldraw board (F7). */
  getBoardTheme?: () => BoardThemeTokens;
  /** Active tab id — the fullscreen overlay writes edits back to it (F7). */
  getTabId?: () => string;
  /**
   * F7 writeback: a whiteboard's snapshot changed. `snapshotJson` is the fresh
   * pretty-printed body to splice into the ```tldraw fence with `boardId`.
   */
  onBoardEdit?: (boardId: string, snapshotJson: string) => void;
  /**
   * F7 i18n: localized strings for the inline board chrome (loading text,
   * fullscreen button tooltip, load-failure prefix). Optional — sensible
   * English fallbacks are used when absent so the widget never shows a raw key.
   */
  getBoardStrings?: () => { loading: string; openFull: string; loadFailed: string };
  /** Mindmap fence i18n: localized strings for the inline mindmap chrome. Optional — English fallbacks used when absent. */
  getMindmapStrings?: () => { openFull: string; parseError: string; gateBroken: string };
  /**
   * #354 — Mermaid theme for the current app theme ('dark' for any dark
   * theme). Absent → 'default'. A change takes effect on the next rebuild;
   * the editor dispatches a relayout when the theme changes.
   */
  getMermaidTheme?: () => 'dark' | 'default';
  /** v4.10 #163 — PlantUML opt-in + server; absent/disabled → fences stay source. */
  getPlantuml?: () => { enabled: boolean; server: string };
  /**
   * #353 "Always show Markdown markers": the source stays visible whatever the
   * caret does, so nothing collapses and nothing jumps when a line is clicked.
   * Images still render, as a block below their own (visible) source line;
   * tables, math, HTML blocks and diagrams keep their source. tldraw boards
   * are unaffected — they never reveal source anyway.
   */
  keepSource?: () => boolean;
}
