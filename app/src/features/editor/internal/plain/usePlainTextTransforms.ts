import { nextTick } from 'vue';
import { applyFormat, FORMAT_KINDS, type FormatKind } from '../../../../lib/md-format';
import { type CaseMode, caseTargetRange, nextCaseInCycle, transformCase } from '../../../../lib/text-case';
import { useTabsStore } from '../../../../stores/tabs';
import type { PlainApi } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

/** Case transform and markdown formatting for the plain engine; the shared
 *  decision lives in lib/text-case.ts and lib/md-format.ts. */
export function usePlainTextTransforms(deps: PlainDeps, api: PlainApi) {
  const { props } = deps;
  const {
    emitPlainCursorAndSelection, plainActiveBlock, plainBlockEditors, plainEditor, plainLiveEnabled,
    plainText, recordPlainHistory, updatePlainBlock,
  } = api;
  const tabs = useTabsStore();

  function onTransformCase(e: Event) {
    const detail = (e as CustomEvent).detail || {};
    const mode: CaseMode | 'cycle' = detail.mode || 'cycle';
    // Split view mounts one Editor per pane and they all hear this event, so
    // only the one showing the active tab may act.
    if (props.tab.id !== tabs.activeId) return;

    // The block editor edits one block's textarea, the flat one edits the
    // whole document, so resolve the element first and then share the rest.
    const el = plainLiveEnabled.value
      ? plainBlockEditors.value[plainActiveBlock.value]
      : plainEditor.value;
    if (!el) return;
    const target = caseTargetRange(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0);
    if (!target) return;
    const next = mode === 'cycle' ? nextCaseInCycle(target.text) : mode;
    const replaced = transformCase(target.text, next);
    if (replaced === target.text) return;
    const value = el.value.slice(0, target.from) + replaced + el.value.slice(target.to);
    recordPlainHistory();
    if (plainLiveEnabled.value) {
      updatePlainBlock(plainActiveBlock.value, value, target.from + replaced.length);
      nextTick(() => {
        const e2 = plainBlockEditors.value[plainActiveBlock.value];
        if (e2) {
          e2.focus();
          e2.setSelectionRange(target.from, target.from + replaced.length);
        }
      });
      return;
    }
    el.value = value;
    plainText.value = value;
    tabs.setContent(props.tab.id, value);
    nextTick(() => {
      el.focus();
      el.setSelectionRange(target.from, target.from + replaced.length);
      emitPlainCursorAndSelection();
    });
  }

  function onFormatMarkdown(e: Event) {
    const kind = ((e as CustomEvent).detail || {}).kind as FormatKind;
    if (!FORMAT_KINDS.includes(kind)) return;
    if (props.tab.id !== tabs.activeId) return;
    if (props.tab.language !== 'markdown') return;

    const el = plainLiveEnabled.value
      ? plainBlockEditors.value[plainActiveBlock.value]
      : plainEditor.value;
    if (!el) return;
    const edit = applyFormat(el.value, el.selectionStart ?? 0, el.selectionEnd ?? 0, kind);
    const value = el.value.slice(0, edit.from) + edit.insert + el.value.slice(edit.to);
    recordPlainHistory();
    if (plainLiveEnabled.value) {
      updatePlainBlock(plainActiveBlock.value, value, edit.selTo);
      nextTick(() => {
        const e2 = plainBlockEditors.value[plainActiveBlock.value];
        if (!e2) return;
        e2.focus();
        // A fence or a blank line can split the block, and then these offsets
        // belong to a different textarea — leave the caret where the re-split
        // put it rather than selecting the wrong text.
        if (e2.value === value) e2.setSelectionRange(edit.selFrom, edit.selTo);
      });
      return;
    }
    const keepScroll = el.scrollTop;
    el.value = value;
    plainText.value = value;
    tabs.setContent(props.tab.id, value);
    nextTick(() => {
      el.focus();
      el.setSelectionRange(edit.selFrom, edit.selTo);
      el.scrollTop = keepScroll;
      emitPlainCursorAndSelection();
    });
  }

  function installTextTransformListeners(): () => void {
    window.addEventListener('solomd:transform-case', onTransformCase as EventListener);
    window.addEventListener('solomd:format-markdown', onFormatMarkdown as EventListener);
    return () => {
      window.removeEventListener('solomd:transform-case', onTransformCase as EventListener);
      window.removeEventListener('solomd:format-markdown', onFormatMarkdown as EventListener);
    };
  }

  return { installTextTransformListeners };
}
