export type MindmapIconName =
  | 'lens-data' | 'lens-map' | 'lens-doc'
  | 'dir-left' | 'dir-right' | 'dir-side'
  | 'graph' | 'lock' | 'panel' | 'undo' | 'redo' | 'export' | 'more'
  | 'fullscreen' | 'center' | 'zoom-out' | 'zoom-in' | 'fit' | 'root' | 'pan';

export type MindmapControlStyle = 'classic' | 'compact';

export const MINDMAP_CONTROL_STYLES: readonly MindmapControlStyle[] = ['classic', 'compact'];
export const DEFAULT_MINDMAP_CONTROL_STYLE: MindmapControlStyle = 'classic';

export function normalizeControlStyle(value: unknown): MindmapControlStyle {
  return MINDMAP_CONTROL_STYLES.includes(value as MindmapControlStyle) ? (value as MindmapControlStyle) : DEFAULT_MINDMAP_CONTROL_STYLE;
}
