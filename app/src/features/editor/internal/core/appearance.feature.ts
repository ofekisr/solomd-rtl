import { bidiExtension } from '../../../../lib/cm-bidi.ts';
import { createLanguageExtension, loadLanguageExtension } from '../../../../lib/editor-language.ts';
import { cmThemeFor } from '../../../../lib/themes.ts';
import type { EditorFeature, EditorFeatureContext } from '../../contracts/editor-feature.port.ts';
import { fontSizeTheme } from './font-theme.ts';

const BIDI_AUTO_LANGUAGES = ['markdown', 'plaintext'];
export const LANGUAGE_SLOT_KEY = 'appearance:language';
export const RELAYOUT_EVENT = 'solomd:cm-relayout';

function applyLazyLanguage(ctx: EditorFeatureContext, language: string): void {
  void loadLanguageExtension(language)?.then((support) => {
    if (ctx.tab().language !== language) return;
    ctx.reconfigure(LANGUAGE_SLOT_KEY, support);
  });
}

export function createAppearanceFeature(): EditorFeature {
  return {
    id: 'appearance',
    settingsKeys: ['fontSize', 'fontFamily'],
    i18nKeys: [],
    slots: [
      {
        slot: 'direction',
        deps: (ctx) => ctx.tab().language,
        build: (ctx) => bidiExtension(BIDI_AUTO_LANGUAGES.includes(ctx.tab().language) ? undefined : 'ltr'),
      },
      {
        slot: 'language',
        deps: (ctx) => ctx.tab().language,
        build: (ctx) => createLanguageExtension(ctx.tab().language),
        after: (ctx) => applyLazyLanguage(ctx, ctx.tab().language),
      },
      {
        slot: 'theme',
        deps: (ctx) => ctx.themeMode(),
        build: (ctx) => cmThemeFor(ctx.themeMode()),
        // Live-edit Mermaid widgets carry their theme; rebuild the block field so
        // diagrams on screen re-render for the new light/dark family (#354).
        after: () => { window.dispatchEvent(new CustomEvent(RELAYOUT_EVENT)); },
      },
      {
        slot: 'font',
        deps: (ctx) => [ctx.settings.fontSize, ctx.settings.fontFamily],
        build: (ctx) => fontSizeTheme(ctx.settings.fontSize, ctx.settings.fontFamily),
      },
    ],
    onMount: (ctx) => applyLazyLanguage(ctx, ctx.tab().language),
    onTabSwitch: (ctx) => applyLazyLanguage(ctx, ctx.tab().language),
  };
}
