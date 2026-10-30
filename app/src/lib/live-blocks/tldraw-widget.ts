import { WidgetType } from '@codemirror/view';
import { type BoardThemeTokens } from '../tldraw-board.ts';
import { type BlockOptions } from './options.ts';

// v4.6 F7 — ```tldraw fenced whiteboard. Unlike mermaid (which collapses only
// when the cursor leaves), the board ALWAYS replaces the fence: the JSON is
// never meant to be hand-edited. The widget mounts a LIVE tldraw editor via the
// dynamic-import adapter (tldraw-runtime.ts) so the rest of the app compiles
// without the dep. Edits debounce 350ms inside the adapter, then splice ONLY
// the fence body back through the writeback callback (→ tabs.setContent),
// exactly like Tolaria's onSnapshotChange → tldrawMarkdown round-trip.
export class TldrawWidget extends WidgetType {
  constructor(
    private readonly boardId: string,
    private readonly height: string,
    private readonly width: string,
    private readonly snapshot: string,
    private readonly opts: BlockOptions,
  ) {
    super();
  }

  // Re-mount only when the board IDENTITY or stored snapshot changes — NOT on
  // every keystroke elsewhere in the doc. This is what makes the always-render
  // model viable: a relayout that doesn't touch this fence reuses the same
  // widget DOM (eq → true) so the tldraw instance is never torn down (avoids
  // the canvas remounting on every keystroke near it, per the plan's risks).
  eq(other: TldrawWidget): boolean {
    return (
      other.boardId === this.boardId &&
      other.height === this.height &&
      other.width === this.width &&
      other.snapshot === this.snapshot
    );
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-live-block cm-live-block--tldraw';
    wrap.setAttribute('data-board-id', this.boardId);
    // Bordered card lives one level down so the wrap's padding (the old
    // inter-block margin, see #155) stays outside the border.
    const card = document.createElement('div');
    card.className = 'cm-tldraw-card';
    const h = parseInt(this.height, 10);
    card.style.height = `${Number.isFinite(h) && h > 0 ? h : 520}px`;
    if (this.width) card.style.maxWidth = `${this.width}px`;
    wrap.appendChild(card);

    // Overflow toolbar: a fullscreen toggle that pops the board into the
    // WhiteboardOverlay (full-window editor). The board id + current snapshot
    // are handed off so the overlay edits the SAME fence.
    const toolbar = document.createElement('div');
    toolbar.className = 'cm-tldraw-toolbar';
    const strings = this.opts.getBoardStrings?.() ?? {
      loading: 'Loading whiteboard…',
      openFull: 'Open fullscreen',
      loadFailed: 'Whiteboard failed to load',
    };
    const fullBtn = document.createElement('button');
    fullBtn.className = 'cm-tldraw-fullscreen';
    fullBtn.type = 'button';
    fullBtn.title = strings.openFull;
    fullBtn.setAttribute('aria-label', strings.openFull);
    fullBtn.textContent = '⛶';
    fullBtn.addEventListener('mousedown', (ev) => ev.preventDefault());
    fullBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const handle = (wrap as unknown as { __boardHandle?: { getSnapshotString(): string } })
        .__boardHandle;
      const snap = handle?.getSnapshotString?.() ?? this.snapshot;
      window.dispatchEvent(
        new CustomEvent('solomd:whiteboard-open', {
          detail: {
            boardId: this.boardId,
            tabId: this.opts.getTabId?.() ?? '',
            snapshot: snap,
          },
        }),
      );
    });
    toolbar.appendChild(fullBtn);
    card.appendChild(toolbar);

    const surface = document.createElement('div');
    surface.className = 'cm-tldraw-surface';
    card.appendChild(surface);

    const placeholder = document.createElement('div');
    placeholder.className = 'cm-tldraw-loading';
    const spinner = document.createElement('span');
    spinner.className = 'cm-tldraw-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const loadingLabel = document.createElement('span');
    loadingLabel.textContent = strings.loading;
    placeholder.append(spinner, loadingLabel);
    surface.appendChild(placeholder);

    // Mount asynchronously — the adapter dynamic-imports tldraw on first use.
    const theme: BoardThemeTokens = this.opts.getBoardTheme?.() ?? {
      colorScheme: 'light',
      locale: 'en',
    };
    const boardId = this.boardId;
    let destroyed = false;
    void import('../tldraw-runtime')
      .then(({ mountBoard }) =>
        mountBoard(surface, {
          snapshot: this.snapshot,
          theme,
          onSnapshotChange: (snapshotJson) => {
            // Splice the new snapshot back into the note's Markdown. We resolve
            // the fence by board id at write time (positions drift as the doc
            // is edited), keeping height/width attributes intact.
            this.opts.onBoardEdit?.(boardId, snapshotJson);
          },
        }),
      )
      .then((handle) => {
        if (destroyed) {
          handle.destroy();
          return;
        }
        placeholder.remove();
        (wrap as unknown as { __boardHandle?: unknown }).__boardHandle = handle;
        // Expose the live board instance for the dev-bridge self-test.
        try {
          const reg =
            ((window as any).__solomdBoards ||= new Map<string, unknown>());
          reg.set(boardId, handle);
        } catch {
          /* dev-only */
        }
      })
      .catch((e) => {
        placeholder.className = 'cm-tldraw-loading cm-live-block--broken';
        placeholder.textContent = `${strings.loadFailed}: ${(e as Error).message}`;
      });

    // Stash a teardown hook the widget's destroy() path can call.
    (wrap as unknown as { __destroyBoard?: () => void }).__destroyBoard = () => {
      destroyed = true;
      const handle = (wrap as unknown as { __boardHandle?: { destroy(): void } })
        .__boardHandle;
      try {
        handle?.destroy();
      } catch {
        /* already gone */
      }
      try {
        (window as any).__solomdBoards?.delete(boardId);
      } catch {
        /* dev-only */
      }
    };

    return wrap;
  }

  destroy(dom: HTMLElement): void {
    // CM calls destroy() when the widget DOM is removed (relayout / unmount).
    // Tear down the tldraw React root so we don't leak an editor per relayout.
    (dom as unknown as { __destroyBoard?: () => void }).__destroyBoard?.();
  }

  // The board owns all pointer/keyboard interaction inside its canvas — let
  // those events through to tldraw rather than routing them to CodeMirror.
  ignoreEvent(): boolean {
    return true;
  }
}
