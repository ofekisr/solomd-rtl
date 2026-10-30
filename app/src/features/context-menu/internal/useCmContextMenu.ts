import { ref, type Ref } from 'vue';
import type { EditorView } from '@codemirror/view';
import type { EditorMenuAction } from '../../../components/EditorContextMenu.vue';
import { openInGoogleTranslate } from '../../../lib/open-google-translate.ts';
import { isAndroid, isIOS, isWindowsEditorRuntime } from '../../../lib/platform.ts';
import { cmSelectionText, runCmMenuAction } from './cm-menu-actions.ts';
import { readClipboard, writeClipboard } from './clipboard.ts';

export interface EditorContextPosition { x: number; y: number; hasSelection: boolean }

const CM_CLIPBOARD = { read: readClipboard, write: writeClipboard };

function isTouchLike(event: MouseEvent): boolean {
  const pointer = (event as PointerEvent).pointerType;
  return pointer === 'touch' || pointer === 'pen' || isAndroid() || isIOS();
}

export function useCmContextMenu(getView: () => EditorView | null): {
  editorCtx: Ref<EditorContextPosition | null>;
  onContextMenu(event: MouseEvent): void;
  onMenuAction(id: EditorMenuAction): Promise<void>;
} {
  const editorCtx = ref<EditorContextPosition | null>(null);

  function onContextMenu(event: MouseEvent): void {
    if (isTouchLike(event)) return;
    const view = getView();
    if (!isWindowsEditorRuntime()) {
      if (!view || view.state.selection.main.empty) return;
    }
    event.preventDefault();
    const hasSelection = !!view && !view.state.selection.main.empty;
    editorCtx.value = { x: event.clientX, y: event.clientY, hasSelection };
  }

  async function onMenuAction(id: EditorMenuAction): Promise<void> {
    editorCtx.value = null;
    const view = getView();
    if (id === 'translate') {
      await openInGoogleTranslate(cmSelectionText(view));
      return;
    }
    if (!view) return;
    await runCmMenuAction(view, id, CM_CLIPBOARD);
  }

  return { editorCtx, onContextMenu, onMenuAction };
}
