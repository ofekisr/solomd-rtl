import { watch } from 'vue';
import type { Tab } from '../../../types.ts';
import type { EditorFeaturesHost } from './useEditorFeatures.ts';
import type { CmViewHost } from './useCmView.ts';

const REASSERT_MIN_SCROLL_PX = 50;
const REASSERT_RESET_BELOW_PX = 10;
const REASSERT_DELAYS_MS = [120, 400] as const;

interface CaretMemory { caret: number; scrollTop: number }

export interface CmTabSwitchOptions {
  props: { tab: Tab };
  cm: CmViewHost;
  features: EditorFeaturesHost;
}

/** #169 — one synchronous assignment is not enough: async widget renders (tables / images / mermaid) and CM's
 *  post-setState measure pass can yank the viewport back to the caret, which sits on line 1 when the user scrolled
 *  without ever clicking. Re-assert after layout, but ONLY when the viewport was reset toward the top — never fight
 *  a scroll the user just made. */
function reassertScroll(cm: CmViewHost, scrollTop: number): void {
  const view = cm.view();
  if (!view) return;
  view.scrollDOM.scrollTop = scrollTop;
  const reassert = (): void => {
    const v = cm.view();
    if (v && scrollTop > REASSERT_MIN_SCROLL_PX && v.scrollDOM.scrollTop < REASSERT_RESET_BELOW_PX) {
      v.scrollDOM.scrollTop = scrollTop;
    }
  };
  requestAnimationFrame(reassert);
  for (const delay of REASSERT_DELAYS_MS) setTimeout(reassert, delay);
}

export function useCmTabSwitch(opts: CmTabSwitchOptions): void {
  // #144 — per-tab caret + scroll memory (runtime-only, per editor pane; a tab shown in two split panes keeps an
  // independent position in each). Without it `setState` reset the caret to 0.
  const memory = new Map<string, CaretMemory>();

  watch(() => opts.props.tab.id, (newId, oldId) => {
    const view = opts.cm.view();
    if (!view) return;
    const ids = { oldId, newId };
    // Snapshot the OUTGOING tab first: the view still holds the old document here.
    opts.features.beforeSwitchTab(view, ids);
    if (oldId) {
      memory.set(oldId, { caret: view.state.selection.main.head, scrollTop: view.scrollDOM.scrollTop });
    }
    const saved = newId ? memory.get(newId) : undefined;
    const { content } = opts.props.tab;
    view.setState(opts.cm.buildState(content, Math.min(saved?.caret ?? 0, content.length)));
    opts.features.switchTab(view, ids);
    if (saved) reassertScroll(opts.cm, saved.scrollTop);
  });
}
