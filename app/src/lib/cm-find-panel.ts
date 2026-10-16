/**
 * Mounts the Vue `FindBar` as CodeMirror's search panel (`search({ createPanel })`),
 * replacing the stock panel, with a `FindTarget` adapter over CodeMirror's own
 * search commands. `external` carries queries set from outside the bar (⌘F with
 * a selection); `tick` bumps on doc or selection changes for the "n of m" counter.
 */
import { createApp, h, shallowRef } from 'vue';
import { getActivePinia } from 'pinia';
import type { EditorView, Panel, ViewUpdate } from '@codemirror/view';
import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  setSearchQuery,
} from '@codemirror/search';
import FindBar from '../components/FindBar.vue';
import { unicodeClasses, type FindCounter, type FindSpec, type FindTarget } from './find-spec';

const MAX_COUNTED_MATCHES = 9999;

const CODE_NODES = new Set(['InlineCode', 'FencedCode', 'CodeBlock']);

function touchesCode(state: EditorState, from: number, to: number): boolean {
  const tree = syntaxTree(state);
  for (const [pos, side] of [[from, 1], [to, -1]] as const) {
    for (let node: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(pos, side); node; node = node.parent) {
      if (CODE_NODES.has(node.name)) return true;
    }
  }
  return false;
}

/** One function instance, so `SearchQuery.eq` sees two skip-code queries as equal. */
const outsideCode = (_match: string, state: EditorState, from: number, to: number): boolean =>
  !touchesCode(state, from, to);

function toQuery(spec: FindSpec): SearchQuery {
  return new SearchQuery({
    search: spec.regexp ? unicodeClasses(spec.search) : spec.search,
    replace: spec.replace,
    caseSensitive: spec.caseSensitive,
    regexp: spec.regexp,
    test: spec.skipCode ? outsideCode : undefined,
  });
}

function toSpec(q: SearchQuery): FindSpec {
  return {
    search: q.search,
    replace: q.replace,
    caseSensitive: q.caseSensitive,
    regexp: q.regexp,
    skipCode: q.test === outsideCode,
  };
}

function countMatches(view: EditorView, q: SearchQuery): FindCounter {
  if (!q.search || !q.valid) return { index: 0, total: 0 };
  const caret = view.state.selection.main.from;
  const cursor = q.getCursor(view.state);
  let total = 0;
  let index = 0;
  for (let r = cursor.next(); !r.done && total < MAX_COUNTED_MATCHES; r = cursor.next()) {
    total++;
    if (r.value.from <= caret) index = total;
  }
  return { index, total };
}

class CodeMirrorFindTarget implements FindTarget {
  readonly supportsNamedGroups = false;
  readonly supportsSkipCode = true;
  lastSet: SearchQuery | null = null;

  constructor(private readonly view: EditorView) {}

  setSpec(spec: FindSpec): void {
    const q = toQuery(spec);
    if (q.eq(getSearchQuery(this.view.state))) return;
    this.lastSet = q;
    this.view.dispatch({ effects: setSearchQuery.of(q) });
  }

  isValid(spec: FindSpec): boolean {
    return toQuery(spec).valid;
  }

  counter(spec: FindSpec): FindCounter {
    return countMatches(this.view, toQuery(spec));
  }

  next(): void { findNext(this.view); }
  prev(): void { findPrevious(this.view); }
  replaceOne(): void { replaceNext(this.view); }
  replaceAll(): void { replaceAll(this.view); }

  close(): void {
    closeSearchPanel(this.view);
    this.view.focus();
  }
}

function externalQuery(update: ViewUpdate): SearchQuery | null {
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
    const target = new CodeMirrorFindTarget(view);
    const external = shallowRef(toSpec(getSearchQuery(view.state)));
    const tick = shallowRef(0);
    const app = createApp({
      render: () => h(FindBar, { target, external: external.value, tick: tick.value, getFilePath }),
    });
    const pinia = getActivePinia();
    if (pinia) app.use(pinia);
    app.mount(dom);
    return {
      dom,
      top: true,
      update(update: ViewUpdate) {
        const q = externalQuery(update);
        if (q && !(target.lastSet && q.eq(target.lastSet))) external.value = toSpec(q);
        if (q || update.docChanged || update.selectionSet) tick.value++;
      },
      destroy: () => app.unmount(),
    };
  };
}
