export type PasteMapTarget = 'selected' | 'root';

export function resolveInsertTargetId(selectedId: string | null, rootId: string, mode: PasteMapTarget): string {
  return mode === 'selected' && selectedId !== null ? selectedId : rootId;
}
