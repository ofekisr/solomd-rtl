// Editor.vue defineExpose (line 4250), today's signatures
export interface LineSelection { fromLine: number; toLine: number; headLine: number; isEmpty: boolean }
export type FoldAction = 'toggle' | 'all' | 'none' | 'level';
export interface EditorApi {
  getLineSelection(): LineSelection | null;
  gotoLine(line: number): void;
  insertImageFromPath(srcPath: string): Promise<void>;
  insertImageUrl(url: string, alt?: string): void;
  uploadLocalImages(): Promise<void>;
  getViewLine(): number | null;
  scrollToLine(line: number): void;
  lineTopY(line: number): number | null;
  insertMarkdown(snippet: string): void;
  openFind(): void;
  applyFold(action: FoldAction, level?: number): void;
  openTableAtCursor(): void;
  openFormulaAtCursor(): void;
}
export interface DocAccess {
  getDoc(): string;
  getCaret(): number;
  replaceRange(from: number, to: number, text: string): void;
}
