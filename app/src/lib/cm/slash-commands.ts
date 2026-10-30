/**
 * cm-slash-commands.ts — Affine/Notion-style "/" slash command popup.
 *
 * Triggered when the user types `/` at the start of a line or after
 * whitespace in a markdown buffer. Pops a floating menu of insertable
 * Markdown blocks (heading, list, code, table, …); typing further
 * filters; ↑↓ navigate; Enter inserts; Esc dismisses.
 *
 * Implemented as:
 *   - StateField<SlashState | null>  — tracks the active query / range
 *   - showTooltip facet              — renders the floating popup near
 *                                      the trigger position
 *   - keymap Prec.highest            — captures ↑↓/Enter/Esc only when
 *                                      the popup is open
 *   - update listener                — opens / closes / refines query
 *                                      as the doc changes
 *
 * v2.5 — bonus feature for GitHub Discussion #30.
 *
 * No external deps — pure CodeMirror 6 + DOM.
 */

import { StateField, Prec, type Extension } from '@codemirror/state';
import {
  EditorView,
  keymap,
  showTooltip,
  type Tooltip,
  type TooltipView,
} from '@codemirror/view';
import {
  SLASH_BLOCKS,
  filterBlocks,
  expandSnippet,
  type SlashBlock,
} from '../slash-blocks.ts';
import {
  nextSlashState,
  setSlashState,
  isTriggerPosition,
  isInsideCodeContext,
  type SlashCommandsConfig,
  type SlashState,
} from './slash-state.ts';
import { slashTheme } from './slash-theme.ts';

export type { SlashCommandsConfig } from './slash-state.ts';

export const slashStateField = StateField.define<SlashState | null>({
  create: () => null,
  update: nextSlashState,
  provide: (f) =>
    showTooltip.compute([f], (state) => {
      const v = state.field(f);
      if (!v) return null;
      return buildTooltip(v);
    }),
});

// ---------------------------------------------------------------------------
// Tooltip rendering
// ---------------------------------------------------------------------------

let activeConfig: SlashCommandsConfig | null = null;

/**
 * Gitee IK9BC3 — this MUST stay one stable function reference.
 *
 * CM6's tooltip manager decides whether it can keep an existing popup alive
 * by comparing the new tooltip's `create` against the old one *by identity*.
 * This used to be an inline arrow, so every keystroke produced a fresh
 * closure, nothing ever matched, and the whole popup was destroyed and
 * rebuilt on each ArrowDown. Two visible consequences, both reported:
 *
 *   - `scrollTop` went back to 0 on every state change, so a list the user
 *     had scrolled snapped straight back to the top ("dragging the mouse down springs back automatically")
 *   - the `update()` path below — which reuses the rows and scrolls the
 *     active one into view — never ran at all. `create` ran instead, and the
 *     scrollIntoView inside it fires against a popup that is not in the
 *     document yet, so it does nothing. The highlight walked off the bottom
 *     edge and appeared to stop at the last visible row ("with the keyboard, after reaching the divider
 *     the list does not scroll up automatically"), leaving everything below it — Whiteboard included —
 *     unreachable by keyboard.
 *
 * Reading the state here rather than closing over it is what makes the
 * reference hoistable; `create` only ever runs when the popup is opening,
 * and the field is non-null for as long as a tooltip is being shown.
 */
const createSlashPopup = (view: EditorView): TooltipView => {
  const s = view.state.field(slashStateField, false);
  return renderPopup(view, s ?? { triggerPos: 0, end: 0, query: '', selectedIndex: 0 });
};

function buildTooltip(state: SlashState): Tooltip {
  return {
    pos: state.triggerPos,
    above: false,
    arrow: false,
    create: createSlashPopup,
  };
}

function labelOf(b: SlashBlock): string {
  return activeConfig?.labelFor?.(b.id) ?? b.label;
}

function hintOf(b: SlashBlock): string {
  return activeConfig?.hintFor?.(b.id) ?? b.hint;
}

function emptyHintFor(query: string): string {
  return (
    activeConfig?.emptyHint?.(query) ??
    `No commands match "${query}" · Esc to dismiss`
  );
}

function renderPopup(view: EditorView, initial: SlashState): TooltipView {
  const root = document.createElement('div');
  root.className = 'cm-slash-popup';
  root.setAttribute('role', 'listbox');
  root.setAttribute('aria-label', 'Slash commands');

  let lastQuery = '<NEVER>';
  let lastSelectedIndex = -1;
  let rowEls: HTMLDivElement[] = [];

  /**
   * Build the row DOM ONCE per filter-result change. Selected-index updates
   * (the keyboard hot path) just toggle the active class on the existing
   * rows so synthetic mouseenter events don't fire under a stationary
   * cursor (issue #80). The active row also scrollIntoView so users can
   * see what's highlighted when the list is taller than the popup.
   */
  const rebuildRows = (filtered: SlashBlock[]) => {
    root.replaceChildren();
    rowEls = [];

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cm-slash-empty';
      empty.textContent = emptyHintFor(lastQuery);
      root.appendChild(empty);
      return;
    }

    filtered.forEach((b, i) => {
      const row = document.createElement('div');
      row.className = 'cm-slash-row';
      row.setAttribute('role', 'option');
      row.setAttribute('data-id', b.id);

      const icon = document.createElement('span');
      icon.className = 'cm-slash-icon';
      icon.textContent = b.icon;
      row.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'cm-slash-label';
      label.textContent = labelOf(b);
      row.appendChild(label);

      const hint = document.createElement('span');
      hint.className = 'cm-slash-hint';
      hint.textContent = hintOf(b);
      row.appendChild(hint);

      row.addEventListener('mousedown', (ev) => {
        // Prevent the editor losing focus before our handler runs.
        ev.preventDefault();
      });
      row.addEventListener('click', () => {
        const cur = view.state.field(slashStateField, false);
        if (!cur) return;
        insertBlock(view, cur, b);
      });
      row.addEventListener('mousemove', () => {
        // v4.5.x issue #93 — use mousemove (not mouseenter) so that
        // wheel-scrolling the popup doesn't hijack the selection. With
        // mouseenter, rows moving under a stationary cursor during a
        // scroll fire synthetic enter events and the highlight jumps
        // around. mousemove only fires on real pointer movement, so
        // scrolling stays smooth while genuine hover still updates the
        // selection — the "mouse hover updates selection" UX users
        // expect. (Same fix applied to CommandPalette.vue in f5f47a8.)
        const cur = view.state.field(slashStateField, false);
        if (!cur) return;
        view.dispatch({
          effects: setSlashState.of({ ...cur, selectedIndex: i }),
        });
      });

      root.appendChild(row);
      rowEls.push(row);
    });
  };

  const setActive = (idx: number) => {
    for (let i = 0; i < rowEls.length; i++) {
      const active = i === idx;
      rowEls[i].classList.toggle('cm-slash-row--active', active);
      rowEls[i].setAttribute('aria-selected', active ? 'true' : 'false');
      if (active) {
        // v4.3.x issue #80 — keep the highlighted row in view when the
        // user pages through a list taller than the popup. `nearest`
        // scrolls only when needed (avoids jitter on every keystroke).
        rowEls[i].scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const repaint = (s: SlashState) => {
    const filtered = filterBlocks(SLASH_BLOCKS, s.query);
    const clamped = clampIndex(s.selectedIndex, filtered.length);
    const queryChanged = s.query !== lastQuery;
    const indexChanged = clamped !== lastSelectedIndex;
    if (!queryChanged && !indexChanged) return;
    if (queryChanged) {
      lastQuery = s.query;
      rebuildRows(filtered);
      // The new list of rows means we have to re-apply the active class.
      setActive(clamped);
    } else {
      setActive(clamped);
    }
    lastSelectedIndex = clamped;
  };

  repaint(initial);

  return {
    dom: root,
    offset: { x: 0, y: 4 },
    update: (u) => {
      const s = u.state.field(slashStateField, false);
      if (!s) return;
      repaint(s);
    },
    mount: () => {
      // Nothing — initial render done above.
    },
    destroy: () => {
      lastQuery = '<NEVER>';
      lastSelectedIndex = -1;
      rowEls = [];
    },
  };
}

function clampIndex(i: number, len: number): number {
  if (len === 0) return 0;
  if (i < 0) return 0;
  if (i >= len) return len - 1;
  return i;
}

// ---------------------------------------------------------------------------
// Inserting
// ---------------------------------------------------------------------------

function insertBlock(view: EditorView, state: SlashState, block: SlashBlock): void {
  const sel = view.state.selection.main;
  const replaceFrom = state.triggerPos;
  const replaceTo = Math.max(state.end, sel.head);
  // The selection-token needs the user's "live" selection. But by the time
  // the popup is up, the cursor IS the selection (typing `/foo` collapses).
  // The intended workflow for wrapping is: user selects → hits `/` → picks
  // bold. In that case, when `/` was typed the selection collapsed to the
  // trigger; we don't have the original selection any more. So treat
  // ${selection} as empty here. Wrappers fall back to ${cursor}-style
  // placement via expandSnippet.
  const expanded = expandSnippet(block.snippet, '');
  view.dispatch({
    changes: { from: replaceFrom, to: replaceTo, insert: expanded.text },
    selection: { anchor: replaceFrom + expanded.cursorOffset },
    effects: setSlashState.of(null),
    scrollIntoView: true,
  });
  view.focus();
}

// ---------------------------------------------------------------------------
// Trigger detection — runs on every doc change, opens the popup when
// the user types `/` at line start or after whitespace.
// ---------------------------------------------------------------------------


function makeUpdateListener(config: SlashCommandsConfig) {
  return EditorView.updateListener.of((u) => {
    if (!u.docChanged) return;
    if (!config.enabled()) return;

    const cur = u.state.field(slashStateField, false);
    if (cur) return; // already open — the StateField update path handles refinement

    // Was the most recent change a single `/` insertion?
    let inserted = '';
    let insertPos = -1;
    u.changes.iterChanges((_fA, _tA, fB, tB, ins) => {
      if (insertPos !== -1) return;
      if (ins.length === 0) return;
      inserted = ins.toString();
      insertPos = tB;
      void fB;
    });
    if (inserted !== '/') return;
    const triggerPos = insertPos - 1;

    if (!isTriggerPosition(u.state, triggerPos)) return;
    if (isInsideCodeContext(u.state, triggerPos)) return;

    u.view.dispatch({
      effects: setSlashState.of({
        triggerPos,
        end: insertPos,
        query: '',
        selectedIndex: 0,
      }),
    });
  });
}

// ---------------------------------------------------------------------------
// Keymap — only active when popup is open.
// ---------------------------------------------------------------------------

function navigate(view: EditorView, delta: number): boolean {
  const s = view.state.field(slashStateField, false);
  if (!s) return false;
  const filtered = filterBlocks(SLASH_BLOCKS, s.query);
  if (filtered.length === 0) return true; // swallow but no-op
  const next = (s.selectedIndex + delta + filtered.length) % filtered.length;
  view.dispatch({ effects: setSlashState.of({ ...s, selectedIndex: next }) });
  return true;
}

function dismissPopup(view: EditorView): boolean {
  const s = view.state.field(slashStateField, false);
  if (!s) return false;
  view.dispatch({ effects: setSlashState.of(null) });
  return true;
}

function commitSelected(view: EditorView): boolean {
  const s = view.state.field(slashStateField, false);
  if (!s) return false;
  const filtered = filterBlocks(SLASH_BLOCKS, s.query);
  if (filtered.length === 0) return true; // swallow Enter so we don't insert a newline
  const block = filtered[clampIndex(s.selectedIndex, filtered.length)];
  insertBlock(view, s, block);
  return true;
}

const popupKeymap = Prec.highest(
  keymap.of([
    { key: 'ArrowDown', run: (v) => navigate(v, 1) },
    { key: 'ArrowUp', run: (v) => navigate(v, -1) },
    { key: 'Tab', run: (v) => navigate(v, 1) },
    { key: 'Shift-Tab', run: (v) => navigate(v, -1) },
    { key: 'Enter', run: commitSelected },
    { key: 'Escape', run: dismissPopup },
  ]),
);


// ---------------------------------------------------------------------------
// Public extension factory
// ---------------------------------------------------------------------------

/**
 * CodeMirror 6 extension that adds an Affine/Notion-style slash-command
 * popup to a markdown editor.
 *
 *   slashCommandsExtension({ enabled: () => settings.slashCommandsEnabled })
 */
export function slashCommandsExtension(config: SlashCommandsConfig): Extension {
  // We stash the active config in module scope so the popup renderer
  // can read it without each row capturing a closure. Multiple editors
  // in one window would each call this factory and overwrite — that's
  // fine because i18n keys are global and all editors share the same
  // catalog. (If a future feature wants per-editor overrides, swap the
  // module-scope ref for a Facet.)
  activeConfig = config;
  return [slashStateField, makeUpdateListener(config), popupKeymap, slashTheme];
}
