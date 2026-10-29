// app/src/lib/theme/from-cm.ts
import { toHex6 } from '../user-theme.ts';
import type { TextStyle, Theme, Variant } from './schema.ts';
import { isLight, mixColor } from './color.ts';
import { MIX } from './defaults.ts';

const CODE_KEYS = [
  'keyword', 'string', 'number', 'comment', 'function', 'variable', 'type', 'property', 'operator',
  'punctuation', 'tag', 'attribute', 'regexp', 'constant', 'invalid',
] as const;
const STYLED_KEYS = ['comment', 'keyword', 'function', 'string'] as const;
export type CodeTagKey = (typeof CODE_KEYS)[number] | 'heading' | 'link' | 'emphasis' | 'strong' | 'quote';
type TagStyle = { color: string; italic: boolean; bold: boolean };
type Chrome = {
  background: string; foreground: string; gutterBg: string; gutterFg: string; activeLine: string;
  selection: string; cursor: string; bracket: string; search: string; searchActive: string;
};
export type ExtractedCmTheme = { id: string; name: string; chrome: Chrome; tags: Record<CodeTagKey, TagStyle> };

const GREY_SPREAD = 24;

function isGrey(color: string): boolean {
  const h = toHex6(color).slice(1);
  const ch = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return Math.max(...ch) - Math.min(...ch) < GREY_SPREAD;
}

function textStyleOf(t: TagStyle): TextStyle | undefined {
  if (!t.italic && !t.bold) return undefined;
  return { ...(t.italic ? { italic: true } : {}), ...(t.bold ? { bold: true } : {}) };
}

function codeSection(tags: ExtractedCmTheme['tags']): NonNullable<Variant['code']> {
  const colors = Object.fromEntries(CODE_KEYS.map((k) => [k, tags[k].color]));
  const style = Object.fromEntries(STYLED_KEYS.map((k) => [k, textStyleOf(tags[k])]).filter(([, s]) => s));
  return { colors, ...(Object.keys(style).length ? { style } : {}) };
}

const TRANSPARENT_RE = /^(transparent|rgba\(\s*\d+[\s,]+\d+[\s,]+\d+[\s,/]+0(\.0+)?\s*\))$/i;
const QUOTE_COMMENT_MIX = 0.6;
const CHROME_ACCENT_MIX = { bracket: 0.25, search: 0.3, searchActive: 0.5, selection: 0.3 } as const;

function isTransparent(color: string): boolean {
  return color.trim() === '' || TRANSPARENT_RE.test(color.trim());
}

function distinctOr(candidate: string, text: string, fallback: string): string {
  return toHex6(candidate) === toHex6(text) ? fallback : candidate;
}

type MarkdownStyle = NonNullable<NonNullable<Variant['markdown']>['style']>;

function markdownStyle(tags: ExtractedCmTheme['tags']): MarkdownStyle {
  const entries = (['heading', 'link', 'quote'] as const).map((k) => [k, textStyleOf(tags[k])] as const);
  return Object.fromEntries(entries.filter(([, s]) => s));
}

function markdownSection(tags: ExtractedCmTheme['tags'], text: string): NonNullable<Variant['markdown']> {
  const pick = (k: CodeTagKey, fallback: string): string => distinctOr(tags[k].color, text, fallback);
  const h1 = pick('heading', tags.keyword.color);
  const style = markdownStyle(tags);
  return {
    colors: {
      h1, h2: h1, h3: mixColor(h1, tags.function.color, MIX.h3), h4: mixColor(h1, tags.type.color, MIX.h4),
      strong: pick('strong', tags.function.color), em: pick('emphasis', tags.type.color),
      link: pick('link', tags.string.color), url: tags.string.color, code: tags.string.color,
      quote: pick('quote', mixColor(text, tags.comment.color, QUOTE_COMMENT_MIX)),
    },
    ...(Object.keys(style).length ? { style } : {}),
  };
}

function fillChrome(chrome: Chrome, accent: string): Chrome {
  const fill = (key: keyof typeof CHROME_ACCENT_MIX): string =>
    isTransparent(chrome[key]) ? mixColor(chrome.background, accent, CHROME_ACCENT_MIX[key]) : chrome[key];
  return {
    ...chrome, bracket: fill('bracket'), search: fill('search'), searchActive: fill('searchActive'), selection: fill('selection'),
  };
}

export function cmToTheme(x: ExtractedCmTheme): Theme {
  const { chrome, tags } = x;
  const mode = isLight(chrome.background) ? 'light' : 'dark';
  const accent = isGrey(chrome.cursor) ? tags.function.color : chrome.cursor;
  const { foreground: text, background: bg, ...editorRest } = fillChrome(chrome, accent);
  const variant: Variant = {
    mode,
    app: { colors: { bg, text, accent } },
    markdown: markdownSection(tags, text),
    code: codeSection(tags),
    editor: { colors: { background: bg, ...editorRest } },
  };
  return { id: x.id, name: x.name, version: 1, source: 'catalog', variants: { [mode]: variant } };
}
