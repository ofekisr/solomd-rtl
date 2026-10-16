const GOOGLE_TRANSLATE_BASE = 'https://translate.google.com/';
const MAX_TRANSLATE_CHARS = 5000;
const FALLBACK_TARGET = 'en';

export function translateTargetLanguage(locale: string | undefined): string {
  const primary = (locale ?? '').split(/[-_]/)[0]?.toLowerCase();
  return primary && /^[a-z]{2,3}$/.test(primary) ? primary : FALLBACK_TARGET;
}

export function googleTranslateUrl(text: string, targetLang: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const params = new URLSearchParams({
    sl: 'auto',
    tl: targetLang,
    text: Array.from(trimmed).slice(0, MAX_TRANSLATE_CHARS).join(''),
    op: 'translate',
  });
  return `${GOOGLE_TRANSLATE_BASE}?${params.toString()}`;
}
