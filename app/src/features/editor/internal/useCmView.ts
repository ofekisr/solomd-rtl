import { watch, type Ref } from 'vue';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import type { EditorFeatureContext } from '../contracts/editor-feature.port.ts';
import type { EditorFeaturesHost } from './useEditorFeatures.ts';

const CONTENT_SYNC_DEBOUNCE_MS = 350;
const FLUSH_EVENT = 'solomd:flush-content-sync';
const RELAYOUT_EVENT = 'solomd:relayout';
const MARKDOWN = 'markdown';

export interface CmViewOptions {
  host: Ref<HTMLDivElement | null>;
  ctx: EditorFeatureContext;
  features: EditorFeaturesHost;
  emitCursor(line: number, col: number): void;
  emitSelection(text: string): void;
  noteTypedFormat(prefix: string, ch: string): void;
}

export interface CmViewHost {
  view(): EditorView | null;
  /** Slot `update-listener`: the host appends it AFTER `features.extensions()`; `buildState` does so already. */
  updateListener(): Extension;
  mount(): void;
  unmount(): void;
  buildState(doc: string, anchor?: number): EditorState;
}

type DevWindow = { __solomdActiveView?: EditorView };

export function useCmView(opts: CmViewOptions): CmViewHost {
  const { ctx, features } = opts;
  let view: EditorView | null = null;
  let contentSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let cleanupListeners: (() => void) | null = null;

  /** Synchronous counterpart to the debounce below. `saveTab` broadcasts `solomd:flush-content-sync` right before
   *  reading `tab.content`: a save landing inside the debounce window would otherwise write a stale document
   *  (fatal for vim's `:wq` (#222), which closes the tab right after the save and drops the unsynced tail).
   *  While an IME composition is in flight the timer stays armed (same reasoning as #186). */
  function flushContentSync(): void {
    if (!contentSyncTimer || !view || view.composing) return;
    clearTimeout(contentSyncTimer);
    contentSyncTimer = null;
    ctx.setContent(ctx.tab().id, view.state.doc.toString());
  }

  function syncContentSoon(text: string): void {
    if (contentSyncTimer) clearTimeout(contentSyncTimer);
    contentSyncTimer = setTimeout(() => {
      contentSyncTimer = null;
      // #186 — read the doc at fire time, not schedule time. A snapshot taken before an IME composition started is
      // stale by now; the external-content watcher would "restore" it with a full-doc replace, killing the
      // composition and mapping the caret to offset 0. While composing, re-arm: the candidate commit lands as a
      // non-composing update and syncs then.
      if (view) {
        if (view.composing) {
          syncContentSoon(text);
          return;
        }
        ctx.setContent(ctx.tab().id, view.state.doc.toString());
        return;
      }
      ctx.setContent(ctx.tab().id, text);
    }, CONTENT_SYNC_DEBOUNCE_MS);
  }

  function noteTypedFormats(u: Parameters<Parameters<typeof EditorView.updateListener.of>[0]>[0]): void {
    for (const tr of u.transactions) {
      if (!tr.isUserEvent('input.type')) continue;
      tr.changes.iterChanges((_fa, _ta, _fb, toB, inserted) => {
        if (inserted.length !== 1) return;
        const line = u.state.doc.lineAt(toB);
        opts.noteTypedFormat(line.text.slice(0, toB - line.from), inserted.toString());
      });
    }
  }

  const updateListener = (): Extension =>
    EditorView.updateListener.of((u) => {
      if (u.docChanged && !u.view.composing) syncContentSoon(u.state.doc.toString());
      if (u.docChanged && !u.view.composing && ctx.tab().language === MARKDOWN) noteTypedFormats(u);
      if (!u.selectionSet) return;
      const sel = u.state.selection.main;
      const line = u.state.doc.lineAt(sel.head);
      opts.emitCursor(line.number, sel.head - line.from + 1);
      // v4.3.0 issue #70: selected text for the StatusBar word/char count; '' when nothing is selected.
      opts.emitSelection(sel.empty ? '' : u.state.sliceDoc(sel.from, sel.to));
    });

  const buildState = (doc: string, anchor?: number): EditorState =>
    EditorState.create({
      doc,
      extensions: [...features.extensions(), updateListener()],
      selection: anchor === undefined ? undefined : { anchor },
    });

  function exposeForDev(v: EditorView): void {
    // Vite injects import.meta.env.DEV only in dev builds; production bundles drop this.
    if (import.meta.env.DEV) (window as unknown as DevWindow).__solomdActiveView = v;
  }

  function listenWindow(): void {
    // Right-sidebar pane visibility / splitter drags change the editor width but CodeMirror's ResizeObserver may
    // lag a frame: an explicit relayout event forces a re-measure (search pane toggle, rs-pane-host stack).
    const onRelayout = (): void => view?.requestMeasure();
    window.addEventListener(RELAYOUT_EVENT, onRelayout);
    window.addEventListener(FLUSH_EVENT, flushContentSync);
    cleanupListeners = () => {
      window.removeEventListener(RELAYOUT_EVENT, onRelayout);
      window.removeEventListener(FLUSH_EVENT, flushContentSync);
    };
  }

  function mount(): void {
    if (!opts.host.value) return;
    view = new EditorView({ state: buildState(ctx.tab().content), parent: opts.host.value });
    features.mount(view);
    exposeForDev(view);
    listenWindow();
  }

  function flushPendingOnUnmount(): void {
    if (!contentSyncTimer) return;
    // A Vim-mode toggle remounts the Windows editor: flush the current document before cancelling the debounce so
    // the last keystroke cannot disappear during the hand-off.
    if (view && !view.composing) ctx.setContent(ctx.tab().id, view.state.doc.toString());
    clearTimeout(contentSyncTimer);
    contentSyncTimer = null;
  }

  function unmount(): void {
    if (view) features.unmount(view);
    cleanupListeners?.();
    cleanupListeners = null;
    flushPendingOnUnmount();
    if (import.meta.env.DEV) {
      const w = window as unknown as DevWindow;
      if (w.__solomdActiveView === view) delete w.__solomdActiveView;
    }
    view?.destroy();
    view = null;
  }

  // A tab switch also changes `content`; useCmTabSwitch owns that swap (it must snapshot the outgoing doc's caret
  // and scroll before the doc changes), so only same-tab external edits are applied here.
  watch(() => [ctx.tab().id, ctx.tab().content] as const, ([id, next], [prevId]) => {
    if (id !== prevId) return;
    if (!view || view.state.doc.toString() === next) return;
    // #186 defense-in-depth: never interrupt an active IME composition (dispatching aborts it and strands the
    // composed text) and keep the caret at its old offset instead of letting the full-doc replace map it to 0.
    // The editor is the source of truth while typing; a skipped write is re-reconciled by the next content sync.
    if (view.composing) return;
    const head = Math.min(view.state.selection.main.head, next.length);
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: next },
      selection: { anchor: head },
    });
  });

  return { view: () => view, updateListener, mount, unmount, buildState };
}
