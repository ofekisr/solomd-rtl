import { type AcItem, type AcKind, buildAcItems as buildAcItemsFrom } from './plain-autocomplete-items.ts';
import { caretTopPx } from '../../../../lib/textarea-metrics';
import { directiveCompletionManifests } from '../../../../lib/directive-completion-registry';
import { isInsideFenceBefore, matchFenceOpener } from '../../../../lib/fence-languages';
import { nativeDirectiveCompletion } from '../../../../lib/native-directive-completions';
import { nextTick, ref } from 'vue';
import { recordFenceLanguage } from '../../../../lib/fence-recents';
import { useTabsStore } from '../../../../stores/tabs';
import { useWorkspaceIndexStore } from '../../../../stores/workspaceIndex';
import { late } from './plain-late.ts';
import type { PlainApiStage7 } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

export function usePlainAutocomplete(deps: PlainDeps, api: PlainApiStage7) {
  const { props } = deps;
  const tabs = useTabsStore();
  const workspaceIndex = useWorkspaceIndexStore();
  const { emitPlainCursorAndSelection, plainActiveBlock, plainBlockEditors, plainComposing, plainEditor, plainLineHeightPx, plainLiveEnabled, plainText, recordPlainHistory } = api;
  const updatePlainBlock = late(api, 'updatePlainBlock');

  // ---- Plain editor: autocomplete popup (/ slash commands, [[ wikilinks,
  // # tags, @ citations, ``` fence languages, manifest directives). Triggers as you type; ↑/↓
  // navigate, Enter/Tab insert, Esc dismisses. Reuses the same data the
  // CodeMirror editor uses. ----
  const acOpen = ref(false);
  const acItems = ref<AcItem[]>([]);
  const acIndex = ref(0);
  const acPos = ref<{ left: number; top: number }>({ left: 0, top: 0 });
  let acTriggerStart = -1;
  let acTriggerEnd = -1;
  let acUsesFixedRange = false;

  const acSources = {
    notes: () => workspaceIndex.entries || [],
    tags: () => workspaceIndex.tags || [],
    citations: () => deps.getCitations(),
  };

  function buildAcItems(kind: AcKind, query: string): AcItem[] {
    return buildAcItemsFrom(kind, query, acSources);
  }

  function closePlainAutocomplete() {
    acOpen.value = false;
    acItems.value = [];
    acTriggerStart = -1;
    acTriggerEnd = -1;
    acUsesFixedRange = false;
  }

  function caretRectFromHighlight(caret: number): { left: number; bottom: number } | null {
    if (plainLiveEnabled.value) {
      // Anchor the autocomplete popup to the active block's textarea (bottom-left).
      // A textarea can't give per-caret pixel coords without a mirror element, and
      // blocks are short, so anchoring below the block is accurate enough.
      const el = plainBlockEditors.value[plainActiveBlock.value];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, bottom: r.top + Math.min(r.height, 24) };
    }
    // Flat plain editor: one textarea holds the whole document, so "below the
    // element" would be nowhere near the caret. Measure the caret's own row.
    const el = plainEditor.value;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = window.getComputedStyle(el);
    const padTop = Number.parseFloat(cs.paddingTop || '0') || 0;
    const padLeft = Number.parseFloat(cs.paddingLeft || '0') || 0;
    const top = caretTopPx(el, el.value, Math.max(0, Math.min(caret, el.value.length)));
    return {
      left: r.left + padLeft,
      bottom: r.top + padTop + top - el.scrollTop + plainLineHeightPx(),
    };
  }

  function maybeOpenPlainAutocomplete(el: HTMLTextAreaElement) {
    if (plainComposing.value) return;
    const caret = el.selectionStart ?? 0;
    const before = el.value.slice(0, caret);
    const directive = props.tab.language === 'markdown'
      ? nativeDirectiveCompletion(el.value, caret, directiveCompletionManifests())
      : null;
    let kind: AcKind | null = null;
    let items: AcItem[] | null = null;
    let query = '';
    let m: RegExpMatchArray | null;
    acTriggerEnd = caret;
    acUsesFixedRange = false;
    if (directive) {
      acTriggerStart = directive.from;
      acTriggerEnd = directive.to;
      acUsesFixedRange = true;
      items = directive.items.map((item) => ({ ...item }));
    } else if ((m = before.match(/(?:^|\n)[ \t]*\/([^\s/]*)$/))) { kind = 'slash'; query = m[1]; acTriggerStart = caret - m[1].length - 1; }
    else if ((m = before.match(/\[\[([^\]\n]*)$/))) { kind = 'wikilink'; query = m[1]; acTriggerStart = caret - m[1].length - 2; }
    else if ((m = before.match(/(?:^|[\s(])#([^\s#]*)$/))) { kind = 'tag'; query = m[1]; acTriggerStart = caret - m[1].length - 1; }
    else if ((m = before.match(/(?:^|[\s(])@([^\s@]*)$/))) { kind = 'citation'; query = m[1]; acTriggerStart = caret - m[1].length - 1; }
    else {
      // ``` fence opener (#297). Same helper the CodeMirror source uses, so the
      // two editors cannot disagree about what counts as an opener — and the
      // same "already inside a fence" test, so typing the *closing* fence never
      // pops a list whose Enter would insert a language into it.
      const opener = matchFenceOpener(before);
      if (opener && !isInsideFenceBefore(before.slice(0, before.lastIndexOf('\n') + 1))) {
        kind = 'fence';
        query = opener.query;
        acTriggerStart = opener.queryStart;
      }
    }
    if (!items && !kind) { closePlainAutocomplete(); return; }
    const resolvedItems = items ?? buildAcItems(kind!, query);
    if (!resolvedItems.length) { closePlainAutocomplete(); return; }
    acItems.value = resolvedItems;
    acIndex.value = 0;
    acOpen.value = true;
    nextTick(() => {
      const rect = caretRectFromHighlight(acTriggerStart);
      if (rect) acPos.value = { left: Math.round(rect.left), top: Math.round(rect.bottom + 4) };
    });
  }

  function applyPlainAutocomplete(item: AcItem) {
    if (item.fenceLanguage) recordFenceLanguage(item.fenceLanguage);
    if (!plainLiveEnabled.value) {
      // Flat plain editor — no blocks, so edit the whole-document textarea
      // directly and push the result through the same path as normal typing.
      const flat = plainEditor.value;
      if (!flat || acTriggerStart < 0) { closePlainAutocomplete(); return; }
      const caret = flat.selectionStart ?? flat.value.length;
      const replacementEnd = acUsesFixedRange ? acTriggerEnd : caret;
      const value = flat.value.slice(0, acTriggerStart) + item.insert + flat.value.slice(replacementEnd);
      const newCaret = acTriggerStart + item.cursorOffset;
      closePlainAutocomplete();
      recordPlainHistory();
      flat.value = value;
      plainText.value = value;
      tabs.setContent(props.tab.id, value);
      nextTick(() => {
        flat.focus();
        const p = Math.max(0, Math.min(newCaret, flat.value.length));
        flat.setSelectionRange(p, p);
        emitPlainCursorAndSelection();
      });
      return;
    }
    const el = plainBlockEditors.value[plainActiveBlock.value];
    if (!el || acTriggerStart < 0) { closePlainAutocomplete(); return; }
    const index = plainActiveBlock.value;
    const caret = el.selectionStart ?? el.value.length;
    const start = acTriggerStart;
    const replacementEnd = acUsesFixedRange ? acTriggerEnd : caret;
    const value = el.value.slice(0, start) + item.insert + el.value.slice(replacementEnd);
    const newCaret = start + item.cursorOffset;
    closePlainAutocomplete();
    updatePlainBlock(index, value, newCaret);
    nextTick(() => {
      const e2 = plainBlockEditors.value[plainActiveBlock.value];
      if (e2) {
        e2.focus();
        const p = Math.min(newCaret, e2.value.length);
        e2.setSelectionRange(p, p);
      }
    });
  }

  /** Returns true if the keydown was consumed by the autocomplete popup. */
  function handleAutocompleteKeydown(event: KeyboardEvent): boolean {
    if (!acOpen.value || !acItems.value.length) return false;
    if (event.key === 'ArrowDown') { event.preventDefault(); acIndex.value = (acIndex.value + 1) % acItems.value.length; return true; }
    if (event.key === 'ArrowUp') { event.preventDefault(); acIndex.value = (acIndex.value - 1 + acItems.value.length) % acItems.value.length; return true; }
    if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); applyPlainAutocomplete(acItems.value[acIndex.value]); return true; }
    if (event.key === 'Escape') { event.preventDefault(); closePlainAutocomplete(); return true; }
    return false;
  }

  return {
    acOpen,
    acItems,
    acIndex,
    acPos,
    acSources,
    buildAcItems,
    closePlainAutocomplete,
    caretRectFromHighlight,
    maybeOpenPlainAutocomplete,
    applyPlainAutocomplete,
    handleAutocompleteKeydown,
  };
}
