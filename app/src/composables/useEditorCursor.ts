/**
 * Editor cursor + selection as the shell sees them (Wave 1b): the status bar
 * reads line/col/selection, the Outline follows `outlineLine`.
 */
import { computed, inject, provide, ref, type InjectionKey } from 'vue';
import { useSettingsStore } from '../stores/settings';
import { useTilesStore } from '../stores/tiles';

export type EditorCursor = ReturnType<typeof buildEditorCursor>;

const EDITOR_CURSOR_KEY: InjectionKey<EditorCursor> = Symbol('editorCursor');

function buildEditorCursor() {
  const settings = useSettingsStore();
  const tiles = useTilesStore();
  const cursorLine = ref(1);
  const cursorCol = ref(1);
  // v4.3.0 #70 — selected text for "selected: N words / M chars".
  const selectionText = ref('');
  // #350 — in preview mode the outline follows the reading position.
  const previewTopLine = ref<number | null>(null);

  window.addEventListener('solomd:preview-topline', (e: Event) => {
    const { line, paneId } = (e as CustomEvent).detail || {};
    if (paneId && paneId !== tiles.focusedPaneId) return;
    if (typeof line === 'number' && line > 0) previewTopLine.value = line;
  });

  const outlineLine = computed(() =>
    settings.viewMode === 'preview' && previewTopLine.value != null ? previewTopLine.value : cursorLine.value,
  );

  function onCursor(line: number, col: number): void {
    cursorLine.value = line;
    cursorCol.value = col;
  }

  function onSelection(text: string): void {
    selectionText.value = text;
  }

  function onOutlineGoto(line: number): void {
    window.dispatchEvent(
      new CustomEvent('solomd:outline-goto', { detail: { line, paneId: tiles.focusedPaneId } }),
    );
  }

  return { cursorLine, cursorCol, selectionText, outlineLine, onCursor, onSelection, onOutlineGoto };
}

export function createEditorCursor(): EditorCursor {
  const cursor = buildEditorCursor();
  provide(EDITOR_CURSOR_KEY, cursor);
  return cursor;
}

export function useEditorCursor(): EditorCursor {
  const cursor = inject(EDITOR_CURSOR_KEY);
  if (!cursor) throw new Error('useEditorCursor() called outside createEditorCursor()');
  return cursor;
}
