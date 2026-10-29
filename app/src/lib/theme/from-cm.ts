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

function markdownSection(tags: ExtractedCmTheme['tags'], text: string): NonNullable<Variant['markdown']> {
  const heading = tags.heading.color;
  return {
    colors: {
      h1: heading, h2: heading, h3: mixColor(heading, text, MIX.h3), h4: mixColor(heading, text, MIX.h4),
      strong: tags.strong.color, em: tags.emphasis.color, link: tags.link.color, url: tags.string.color,
      code: tags.string.color, quote: tags.quote.color,
    },
  };
}

export function cmToTheme(x: ExtractedCmTheme): Theme {
  const { chrome, tags } = x;
  const mode = isLight(chrome.background) ? 'light' : 'dark';
  const accent = isGrey(chrome.cursor) ? tags.function.color : chrome.cursor;
  const { foreground: text, background: bg, ...editorRest } = chrome;
  const variant: Variant = {
    mode,
    app: { colors: { bg, text, accent } },
    markdown: markdownSection(tags, text),
    code: codeSection(tags),
    editor: { colors: { background: bg, ...editorRest } },
  };
  return { id: x.id, name: x.name, version: 1, source: 'catalog', variants: { [mode]: variant } };
}
