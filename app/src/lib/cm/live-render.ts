/**
 * cm-live-render.ts — WYSIWYG "live edit" CM6 extension for SoloMD v2.3
 *
 * Goes further than `cm-live-preview.ts`. The preview-style extension hides
 * a few marker characters and lets the HighlightStyle do the rest. This
 * extension is the editor-only "live edit" mode (Typora / Obsidian Live
 * Preview equivalent) — it RENDERS markdown formatting inline:
 *
 *   - `# Heading` → larger bold heading; the `#` is hidden when the caret
 *     is on a different line.
 *   - `**bold**` → bold text; `**` markers hidden when caret is outside.
 *   - `*italic*` / `_italic_` → italic; markers hidden when caret outside.
 *   - `` `code` `` → monospace + bg; backticks hidden when caret outside.
 *   - `[label](url)` → blue + underlined; raw form revealed when caret
 *     enters either the label or the URL part.
 *   - `- item`, `* item`, `1. item` → list bullet/number stays visible
 *     because that IS the visual rendering for a list — but we slim down
 *     the spacing and color it like the preview.
 *   - `> quote` → indented + left bar via a `Decoration.line` class; the
 *     `>` itself stays visible (Typora hides it; we keep it because hiding
 *     the `>` makes new-line-into-quote ergonomics worse).
 *   - Fenced code blocks (`` ``` ``) → grey background; existing syntax
 *     coloring from the markdown package handles the inner tokens.
 *   - `~~strike~~` → strikethrough; markers hidden when caret outside.
 *
 * Caret reveal model: a marker decoration is suppressed (raw markdown
 * shown) when the user's selection touches the same LINE as the marker.
 * Multi-line selections naturally reveal everything they cross.
 *
 * Performance: decoration recompute happens on `docChanged`,
 * `selectionSet`, or `viewportChanged` only, and only iterates the
 * syntax tree over `view.visibleRanges` — i.e. O(viewport) not O(doc).
 *
 * CJK note: the lezer-markdown parser emits `EmphasisMark` nodes
 * regardless of full-width punctuation around markers, so `**bold**` in Chinese
 * just works. We don't post-filter on character classes.
 */

import { syntaxHighlighting } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import { type DecorationSet, type EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';
import { frozenDuringComposition, isImeSafeFlushTransaction } from './ime-guard.ts';
import { isDragging, isDragEndTransaction } from './drag-aware.ts';
import { setFenceMode } from './fence-modes.ts';
import { buildDecorations } from './live-decorations.ts';
import { liveEditHighlightStyle, liveEditTheme } from './live-theme.ts';

export type { MdSyntaxNode } from './live-widgets.ts';
export {
  bulletDeco,
  hrDeco,
  listItemHasTask,
  CodeModeWidget,
  setLiveEditCopyLabel,
  codeBlockClipboardText,
} from './live-widgets.ts';

const makeLiveRenderPlugin = (showMarkers: boolean) => ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view, showMarkers);
    }

    update(u: ViewUpdate) {
      // IME composition guard (#108) — don't rebuild decorations on the
      // composing line while a Windows IME (Sogou) candidate window is open,
      // or the mid-composition DOM swap drops the composition ("swallowed characters").
      const frozen = frozenDuringComposition(u, this.decorations);
      if (frozen) {
        this.decorations = frozen;
        return;
      }
      // See cm-drag-aware.ts — freeze marker toggles during pointer drag
      // so Windows WebView2 doesn't lose pointer capture mid-selection.
      const dragEnded = u.transactions.some(isDragEndTransaction);
      const imeFlush = u.transactions.some(isImeSafeFlushTransaction);
      const modeChanged = u.transactions.some((tr) => tr.effects.some((e) => e.is(setFenceMode)));
      if (u.docChanged || u.viewportChanged || dragEnded || imeFlush || modeChanged) {
        this.decorations = buildDecorations(u.view, showMarkers);
        return;
      }
      // With markers always shown nothing depends on the caret, so a
      // selection move keeps the exact same decorations — no rebuild, no jump.
      if (!showMarkers && u.selectionSet && !isDragging(u.state)) {
        this.decorations = buildDecorations(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);


/**
 * Bundle for the v2.3 "live edit" view mode. Wire into Editor.vue as the
 * rich-extensions value when `viewMode === 'liveEdit'` and the tab is
 * markdown.
 *
 * v3.6 (issue #44): pass the optional `blocks` extensions in to add
 * image / table live-render widgets (cm-live-blocks). The caller is
 * responsible for building those with workspace + file-path context;
 * we just splice them into the bundle so they live in the same
 * compartment as the rest of the live-edit machinery.
 */
const liveRenderPlugin = makeLiveRenderPlugin(false);
const liveRenderPluginShowMarkers = makeLiveRenderPlugin(true);

export function liveEditExtension(blocks: Extension[] = [], opts: { showMarkers?: boolean } = {}) {
  return [
    syntaxHighlighting(liveEditHighlightStyle),
    opts.showMarkers ? liveRenderPluginShowMarkers : liveRenderPlugin,
    liveEditTheme,
    ...blocks,
  ];
}

// ---------------------------------------------------------------------------
// Self-test hook (used by dev-mcp `solomd_get_editor_decorations`).
//
// We expose a tiny window-level helper that, when the editor is mounted,
// reports the current visible-range decoration counts. The Tauri webview
// can't be poked directly from MCP, so this isn't called by the MCP
// server itself — instead the MCP tool returns "look at the DOM by
// querying `.cm-md-heading-line-1` etc.". We document the class names
// there as the contract.
// ---------------------------------------------------------------------------

/**
 * Stable list of class names this extension emits, exported so the dev-mcp
 * `solomd_get_editor_decorations` tool (and any future automated tests)
 * can assert on them.
 */
export const LIVE_EDIT_CLASSES = [
  'cm-md-heading-line-1',
  'cm-md-heading-line-2',
  'cm-md-heading-line-3',
  'cm-md-heading-line-4',
  'cm-md-heading-line-5',
  'cm-md-heading-line-6',
  'cm-md-strong',
  'cm-md-em',
  'cm-md-strike',
  'cm-md-html-u',
  'cm-md-html-mark',
  'cm-md-html-sub',
  'cm-md-html-sup',
  'cm-md-html-kbd',
  'cm-md-code',
  'cm-md-link',
  'cm-md-quote-line',
  'cm-md-fenced-line',
  'cm-md-fence-lang',
  'cm-md-code-copy',
  'cm-md-bullet',
  'cm-md-hr',
  'cm-md-marker',
] as const;
