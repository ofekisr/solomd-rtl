import { z } from 'zod';
import type { SettingsSlice } from '../../contracts/index.ts';

export type GeneralSettings = {
  fontSize: number;
  fontFamily: string;
  wordWrap: boolean;
  showLineNumbers: boolean;
  // #193 — non-blinking (solid) caret in the editor.
  solidCursor: boolean;
  // #353 — keep Markdown markers (`#`, `**`, …) visible in the CodeMirror
  // live views instead of hiding them off the caret line, so clicking a line
  // doesn't reflow it. Styling (heading size, bold) still applies.
  alwaysShowMarkers: boolean;
  // #344 — tint the caret line's background in the CodeMirror editor.
  highlightCurrentLine: boolean;
  // #190 — dedicated code font (code blocks / inline code / mono UI).
  // Empty = built-in monospace stack.
  codeFontFamily: string;
  livePreview: boolean;
  uiFontSize: number;
  language: 'en' | 'ja' | 'ko' | 'de' | 'fr' | 'es' | 'pt' | 'it' | 'pl' | 'nl' | 'tr' | 'sv' | 'uk' | 'ru';
  // #109 — constrain the editor pane to a centered readable column instead of
  // letting long lines stretch the full window width.
  limitEditorWidth: boolean;
  showStatusBarViewModes: boolean;
  // v4.3.0: global UI zoom (scales the entire app — editor, preview, chrome,
  // sidebars, modals). Helpful on high-DPI screens where everything renders
  // too small even at the OS default scale. Range 0.75x – 2.5x. Wired via
  // `document.documentElement.style.zoom`, which Chromium / WebKit / wry all
  // support. Bound to ⌘=, ⌘-, ⌘0 shortcuts. Issue #72.
  globalZoom: number;
  // #215 — whether Ctrl/Cmd + wheel (and trackpad pinch, which arrives as a
  // ctrlKey wheel event) zooms the whole UI. On by default since v4.6.2, but
  // on macOS Cmd is held so often that an incidental trackpad drift would
  // rescale the app; this lets those users switch the gesture off entirely
  // while keeping ⌘= / ⌘- / ⌘0.
  wheelZoomEnabled: boolean;
  // Heading folding in the editor: fold arrows in the gutter, the fold
  // keymap, and the "fold to level N" commands. On by default — a long
  // document is barely navigable without it — but it adds a gutter column, so
  // it can be switched off.
  foldingEnabled: boolean;
};

const schema = z.object({
  fontSize: z.number(),
  fontFamily: z.string(),
  wordWrap: z.boolean(),
  showLineNumbers: z.boolean(),
  solidCursor: z.boolean(),
  alwaysShowMarkers: z.boolean(),
  highlightCurrentLine: z.boolean(),
  codeFontFamily: z.string(),
  livePreview: z.boolean(),
  uiFontSize: z.number(),
  language: z.enum(['en', 'ja', 'ko', 'de', 'fr', 'es', 'pt', 'it', 'pl', 'nl', 'tr', 'sv', 'uk', 'ru']),
  limitEditorWidth: z.boolean(),
  showStatusBarViewModes: z.boolean(),
  globalZoom: z.number(),
  wheelZoomEnabled: z.boolean(),
  foldingEnabled: z.boolean(),
});

function defaults(): GeneralSettings {
  return {
    fontSize: 14,
    fontFamily: 'JetBrains Mono',
    wordWrap: true,
    showLineNumbers: true,
    solidCursor: false,
    alwaysShowMarkers: false,
    highlightCurrentLine: false,
    codeFontFamily: '',
    livePreview: true,
    uiFontSize: 13,
    language: (() => {
      // Detect browser language on first run. Maps navigator BCP-47 tag
      // to one of the 15 shipped UI locales; everything else → 'en'.
      try {
        const nav = typeof navigator !== 'undefined' ? navigator.language || '' : '';
        if (/^ja/i.test(nav)) return 'ja';
        if (/^ko/i.test(nav)) return 'ko';
        if (/^de/i.test(nav)) return 'de';
        if (/^fr/i.test(nav)) return 'fr';
        if (/^es/i.test(nav)) return 'es';
        if (/^pt/i.test(nav)) return 'pt';
        if (/^it/i.test(nav)) return 'it';
        if (/^pl/i.test(nav)) return 'pl';
        if (/^nl/i.test(nav)) return 'nl';
        if (/^tr/i.test(nav)) return 'tr';
        if (/^sv/i.test(nav)) return 'sv';
        if (/^uk/i.test(nav)) return 'uk';
        if (/^ru/i.test(nav)) return 'ru';
        return 'en';
      } catch { return 'en'; }
    })() as 'en' | 'ja' | 'ko' | 'de' | 'fr' | 'es' | 'pt' | 'it' | 'pl' | 'nl' | 'tr' | 'sv' | 'uk' | 'ru',
    limitEditorWidth: false,
    showStatusBarViewModes: true,
    globalZoom: 1,
    wheelZoomEnabled: true,
    foldingEnabled: true,
  };
}

export const generalSlice: SettingsSlice<GeneralSettings> = {
  id: 'general',
  schema,
  defaults,
  normalize(_migrated, merged) {
    if ((merged.language as string) === 'zh') merged.language = 'en';
  },
};
