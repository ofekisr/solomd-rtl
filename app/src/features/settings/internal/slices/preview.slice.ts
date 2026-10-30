import { z } from 'zod';
import { isIOS } from '../../../../lib/platform.ts';
import type { SettingsSlice } from '../../contracts/index.ts';

export type PreviewSettings = {
  // Preview layout
  previewFitWidth: boolean;
  /** v4.10 issue #165 — preview/reading content column width in px (was a
   *  hardcoded 760px). Clamped 480–1600; `previewFitWidth` still overrides
   *  to full-bleed when on. */
  previewMaxWidth: number;
  /** v4.10 issue #163 — PlantUML fences render via a PlantUML server (the
   *  diagram SOURCE is sent to it, so this is opt-in and off by default to
   *  honor local-first; point `plantumlServer` at a self-hosted instance to
   *  keep everything on your network). */
  plantumlEnabled: boolean;
  plantumlServer: string;
  // v2.4: when on, opening any tab on iPad / iPhone snaps view mode to
  // `reading` (no editor chrome — just the rendered prose). Defaults to
  // `true` on iOS, `false` everywhere else. Esc / Cmd+Shift+R still
  // toggles back into edit mode for power users.
  readingByDefaultOnMobile: boolean;
  // v4.3.0: show line numbers next to each line of code in the rendered
  // preview (and Pandoc/PDF/PNG exports — they all share the preview HTML).
  // Default off so existing exports don't surprise anyone. Issue #65.
  codeBlockLineNumbers: boolean;
  // #178: soft-wrap long lines inside fenced code blocks in the preview
  // instead of a horizontal scrollbar. Default off (scroll preserves exact
  // code layout); print/PDF always wraps regardless — paper can't scroll.
  codeBlockWrap: boolean;
  // #279: in split view, tint the preview pane a shade apart from the editor
  // so the two panels aren't identical surfaces. Off by default — it changes
  // how the app looks, which is not something to do to everyone in a patch.
  distinctSplitPanes: boolean;
  // #141 (4.8.10): render a single newline as a real line break (Typora-like)
  // in preview / live editor / every export. Default ON — CJK users write
  // one-sentence-per-line and expect it to hold; standard blank-line
  // paragraphs render identically either way. OFF = strict CommonMark
  // soft-break (newline collapses to a space).
  markdownHardBreaks: boolean;
  // #216: rewrite straight quotes to curly ones in preview/exports
  // (markdown-it `smartquotes`). Default OFF — CJK font fallbacks draw
  // U+2019 fullwidth ("test'　s"), and the preview should match the typed
  // source unless the user opts into typographic quotes.
  smartQuotes: boolean;
  // Promote plain numbered-section lines (`6.2 Export license management catalog`,
  // `6.2.1 …`) to headings whose level tracks the numbering depth. Off by
  // default — the promotion is heuristic (a line opening with a decimal like
  // `3.14 …` also matches), so CJK-report users opt in.
  markdownAutoNumberHeadings: boolean;
  // v4.3.0: preview-pane font size (px). Decoupled from editor `fontSize`
  // so users can tune editor density and preview readability separately
  // (PR #74 — yzcj105). Bound to ⌃⌘+/⌃⌘-/⌃⌘0; the editor axis (existing
  // `fontSize`) is bound to ⌘⇧+/⌘⇧-/⌘⇧0. Range 10–32.
  previewFontSize: number;
};

const schema = z.object({
  previewFitWidth: z.boolean(),
  previewMaxWidth: z.number(),
  plantumlEnabled: z.boolean(),
  plantumlServer: z.string(),
  readingByDefaultOnMobile: z.boolean(),
  codeBlockLineNumbers: z.boolean(),
  codeBlockWrap: z.boolean(),
  distinctSplitPanes: z.boolean(),
  markdownHardBreaks: z.boolean(),
  smartQuotes: z.boolean(),
  markdownAutoNumberHeadings: z.boolean(),
  previewFontSize: z.number(),
});

function defaults(): PreviewSettings {
  return {
    previewFitWidth: false,
    previewMaxWidth: 760,
    plantumlEnabled: false,
    plantumlServer: 'https://www.plantuml.com/plantuml',
    readingByDefaultOnMobile: (() => {
      try {
        return isIOS();
      } catch {
        return false;
      }
    })(),
    codeBlockLineNumbers: false,
    codeBlockWrap: false,
    distinctSplitPanes: false,
    markdownHardBreaks: true,
    smartQuotes: false,
    markdownAutoNumberHeadings: false,
    previewFontSize: 15,
  };
}

export const previewSlice: SettingsSlice<PreviewSettings> = {
  id: 'preview',
  schema,
  defaults,
};
