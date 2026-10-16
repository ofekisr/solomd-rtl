// lib/editor-language.ts
import {markdown, markdownLanguage} from '@codemirror/lang-markdown';
import type {Extension} from '@codemirror/state';
import type { LanguageSupport } from '@codemirror/language';
import {cjkFriendlyEmphasis} from './cm-cjk-emphasis.ts';
import {codeLanguages} from './code-languages.ts';


const languagesByName = new Map(
  codeLanguages.map((language) => [language.name, language]),
);

export function createLanguageExtension(
  language: string,
): Extension {
  if (language === 'markdown') {
    return markdownExt();
  }
  return languagesByName.get(language)?.support ?? [];

}

function markdownExt(): LanguageSupport {
  // Use `markdownLanguage` as the base so GFM features (including task
  // list parsing with TaskMarker nodes) are enabled.
  // `cjkFriendlyEmphasis` keeps live edit in step with the preview on
  // `**Limit:**hard link`-shaped (full-width colon) CJK bold (#262); without it the two panes
  // disagree about the same document.
  return markdown({
    base: markdownLanguage,
    codeLanguages,
    addKeymap: true,
    extensions: [cjkFriendlyEmphasis],
  });
}
