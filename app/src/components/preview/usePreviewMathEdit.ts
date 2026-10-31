import { nextTick, ref } from 'vue';
import { useTabsStore } from '../../stores/tabs';
import { findMathBlock } from './preview-math.ts';

export interface PreviewMathProps { source: string; tabId?: string }

export interface MathEditState { fromLine: number; toLine: number; top: number; left: number; width: number }

export function usePreviewMathEdit(props: PreviewMathProps) {
  const tabs = useTabsStore();
  const mathEdit = ref<MathEditState | null>(null);
  const mathDraft = ref('');
  const mathTextarea = ref<HTMLTextAreaElement | null>(null);

  function onPreviewDblClick(e: MouseEvent) {
    if (!props.tabId) return;
    const block = (e.target as HTMLElement).closest('.md-math-block') as HTMLElement | null;
    if (!block) return;
    const startLine = Number(block.getAttribute('data-source-line') || 0);
    if (!startLine) return;
    const found = findMathBlock(props.source || '', startLine);
    if (!found) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = block.getBoundingClientRect();
    mathEdit.value = {
      fromLine: found.from,
      toLine: found.to,
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.min(Math.max(rect.width, 300), 620),
    };
    mathDraft.value = found.latex;
    nextTick(() => {
      mathTextarea.value?.focus();
      mathTextarea.value?.select();
    });
  }

  function saveMathEdit() {
    if (!mathEdit.value || !props.tabId) return;
    const lines = (props.source || '').split('\n');
    const replacement = ('$$\n' + mathDraft.value.trim() + '\n$$').split('\n');
    lines.splice(mathEdit.value.fromLine, mathEdit.value.toLine - mathEdit.value.fromLine + 1, ...replacement);
    tabs.setContent(props.tabId, lines.join('\n'));
    mathEdit.value = null;
  }

  function cancelMathEdit() {
    mathEdit.value = null;
  }

  function onMathKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); cancelMathEdit(); }
    else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); saveMathEdit(); }
  }

  return { mathEdit, mathDraft, mathTextarea, onPreviewDblClick, saveMathEdit, cancelMathEdit, onMathKeydown };
}
