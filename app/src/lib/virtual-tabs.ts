import type { Language } from '../types';

const VIRTUAL_LANGUAGES: ReadonlySet<string> = new Set<Language>(['git-diff', 'theme-studio']);

export function isVirtualLanguage(lang: string | undefined): boolean {
  return lang !== undefined && VIRTUAL_LANGUAGES.has(lang);
}
