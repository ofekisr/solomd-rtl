/**
 * Mounts the Vue `FindBar` as CodeMirror's search panel (`search({ createPanel })`),
 * replacing the stock panel. `external` carries queries set from outside the bar
 * (⌘F with a selection, `setSearchQuery` from other code); `tick` bumps on doc or
 * selection changes so the bar can refresh its "n of m" counter.
 */
import { createApp, shallowRef } from 'vue';
import { getActivePinia } from 'pinia';
import type { EditorView, Panel, ViewUpdate } from '@codemirror/view';
import { getSearchQuery, setSearchQuery } from '@codemirror/search';
import FindBar from '../components/FindBar.vue';

function externalQuery(update: ViewUpdate) {
  for (const tr of update.transactions) {
    for (const effect of tr.effects) {
      if (effect.is(setSearchQuery)) return effect.value;
    }
  }
  return null;
}

export function createFindPanel(getFilePath: () => string | undefined) {
  return (view: EditorView): Panel => {
    const dom = document.createElement('div');
    dom.className = 'cm-find-panel';
    const external = shallowRef(getSearchQuery(view.state));
    const tick = shallowRef(0);
    const app = createApp(FindBar, { view, external, tick, getFilePath });
    const pinia = getActivePinia();
    if (pinia) app.use(pinia);
    app.mount(dom);
    return {
      dom,
      top: true,
      update(update: ViewUpdate) {
        const q = externalQuery(update);
        if (q) external.value = q;
        if (q || update.docChanged || update.selectionSet) tick.value++;
      },
      destroy: () => app.unmount(),
    };
  };
}
