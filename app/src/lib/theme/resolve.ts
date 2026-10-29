import type { BackdropLayer, TextStyle, ThemeMode, Variant } from './schema.ts';
import type { ColorKey, SectionId } from './tokens.ts';
import { isLight, mixColor } from './color.ts';
import { DANGER, DEFAULT_STYLE, MIX, SOLOMD_CODE, TEXT_ON_ACCENT } from './defaults.ts';

type Colors<S extends SectionId> = Record<ColorKey<S>, string>;
export type ResolvedColors = { [S in SectionId]: Colors<S> };
export type ResolvedStyle = {
  radius: number; backdrop: BackdropLayer[]; panelOpacity: number; panelBlur: number;
  heading: TextStyle; link: TextStyle; quote: TextStyle;
  comment: TextStyle; keyword: TextStyle; function: TextStyle; string: TextStyle;
  activeLine: boolean; nodeRadius: number;
};
export type ResolvedVariant = { mode: ThemeMode; colors: ResolvedColors; style: ResolvedStyle };

function appColors(v: Variant): Colors<'app'> {
  const { bg, text, accent, ...rest } = v.app.colors;
  return {
    bg, text, accent,
    textMuted: rest.textMuted ?? mixColor(text, bg, MIX.muted),
    textFaint: rest.textFaint ?? mixColor(text, bg, MIX.faint),
    accentFg: rest.accentFg ?? (isLight(accent) ? TEXT_ON_ACCENT.onLight : TEXT_ON_ACCENT.onDark),
    danger: rest.danger ?? DANGER[v.mode],
  };
}

function surfaceColors(v: Variant, app: Colors<'app'>): Colors<'surfaces'> {
  const c = v.surfaces?.colors ?? {};
  const panel = c.panel ?? mixColor(app.bg, app.text, MIX.panel);
  return {
    panel,
    hover: c.hover ?? mixColor(app.bg, app.text, MIX.hover),
    active: c.active ?? mixColor(app.bg, app.text, MIX.active),
    soft: c.soft ?? panel,
    border: c.border ?? mixColor(app.bg, app.text, MIX.border),
  };
}

function markdownColors(v: Variant, app: Colors<'app'>, s: Colors<'surfaces'>): Colors<'markdown'> {
  const c = v.markdown?.colors ?? {};
  const { text, textMuted: muted, accent, bg } = app;
  return {
    h1: c.h1 ?? text, h2: c.h2 ?? text, h3: c.h3 ?? mixColor(text, muted, MIX.h3),
    h4: c.h4 ?? mixColor(text, muted, MIX.h4), h5: c.h5 ?? muted, h6: c.h6 ?? mixColor(muted, bg, MIX.h6),
    strong: c.strong ?? text, em: c.em ?? text, link: c.link ?? accent, url: c.url ?? mixColor(accent, text, MIX.url),
    code: c.code ?? accent, codeBg: c.codeBg ?? s.panel, quote: c.quote ?? muted, list: c.list ?? accent, hr: c.hr ?? s.border,
  };
}

function codeColors(v: Variant, app: Colors<'app'>): Colors<'code'> {
  const c = v.code?.colors ?? {};
  const base = { ...SOLOMD_CODE[v.mode], ...c };
  return {
    ...base,
    punctuation: c.punctuation ?? app.text,
    tag: c.tag ?? base.keyword,
    attribute: c.attribute ?? base.property,
    regexp: c.regexp ?? base.string,
    constant: c.constant ?? base.number,
    invalid: c.invalid ?? app.danger,
  };
}

function editorColors(v: Variant, app: Colors<'app'>): Colors<'editor'> {
  const c = v.editor?.colors ?? {};
  const background = c.background ?? app.bg;
  return {
    background,
    gutterBg: c.gutterBg ?? background,
    gutterFg: c.gutterFg ?? app.textFaint,
    activeLine: c.activeLine ?? mixColor(background, app.text, MIX.activeLine),
    selection: c.selection ?? mixColor(app.accent, 'transparent', MIX.selection),
    cursor: c.cursor ?? app.accent,
    bracket: c.bracket ?? mixColor(background, app.accent, MIX.bracket),
    search: c.search ?? mixColor(background, app.accent, MIX.search),
    searchActive: c.searchActive ?? mixColor(background, app.accent, MIX.searchActive),
  };
}

function diagramColors(v: Variant, app: Colors<'app'>, s: Colors<'surfaces'>): Colors<'diagrams'> {
  const c = v.diagrams?.colors ?? {};
  return { nodeBg: c.nodeBg ?? s.panel, nodeBorder: c.nodeBorder ?? app.accent, line: c.line ?? s.border, text: c.text ?? app.text };
}

function pickDefined<T extends object>(o: T | undefined): Partial<T> {
  return Object.fromEntries(Object.entries(o ?? {}).filter(([, val]) => val !== undefined)) as Partial<T>;
}

function resolveStyle(v: Variant): ResolvedStyle {
  return {
    ...DEFAULT_STYLE,
    radius: v.app.style?.radius ?? DEFAULT_STYLE.radius,
    backdrop: v.surfaces?.style?.backdrop ?? [],
    panelOpacity: v.surfaces?.style?.panelOpacity ?? DEFAULT_STYLE.panelOpacity,
    panelBlur: v.surfaces?.style?.panelBlur ?? DEFAULT_STYLE.panelBlur,
    ...pickDefined(v.markdown?.style), ...pickDefined(v.code?.style),
    activeLine: v.editor?.style?.activeLine ?? DEFAULT_STYLE.activeLine,
    nodeRadius: v.diagrams?.style?.nodeRadius ?? DEFAULT_STYLE.nodeRadius,
  };
}

export function resolveVariant(v: Variant): ResolvedVariant {
  const app = appColors(v);
  const surfaces = surfaceColors(v, app);
  return {
    mode: v.mode,
    colors: {
      app, surfaces,
      markdown: markdownColors(v, app, surfaces),
      code: codeColors(v, app),
      editor: editorColors(v, app),
      diagrams: diagramColors(v, app, surfaces),
    },
    style: resolveStyle(v),
  };
}
