/**
 * User-built themes (Theme Studio): two palettes — light and dark — over the
 * app's CSS variables, plus the colour helpers the studio shares with the
 * theme layer. Painting is done by lib/theme, not here.
 */

export type ThemeMode = 'light' | 'dark';
export type Palette = Record<string, string>;

/** Tokens the user picked by hand, per mode. Automatic fills never overwrite these. */
export type EditedTokens = Record<ThemeMode, string[]>;

export interface UserTheme {
  id: string;
  name: string;
  light: Palette;
  dark: Palette;
  edited: EditedTokens;
  /** Corner roundness: 0 = square, 1 = the app's default, 2 = extra round. */
  radius: number;
  gradient: Record<ThemeMode, Backdrop>;
}

export interface BgGradient {
  from: string;
  to: string;
  /** CSS linear-gradient angle in degrees. */
  angle: number;
}

/**
 * What paints behind the window, per mode: a gradient of mine, the plain
 * background colour (null), or whatever a custom CSS theme underneath paints.
 */
export type Backdrop = BgGradient | null | typeof KEEP_CSS_BACKDROP;
export const KEEP_CSS_BACKDROP = 'inherit';

export function isGradient(b: Backdrop): b is BgGradient {
  return !!b && typeof b === 'object';
}

export interface ThemeToken {
  key: string;
  label: string;
  /** Where on screen this colour shows up. */
  hint: string;
}

export interface ThemeTokenGroup {
  id: string;
  label: string;
  /** Which part of the app the whole group paints. */
  area: string;
  tokens: ThemeToken[];
}

export const THEME_TOKEN_GROUPS: ThemeTokenGroup[] = [
  {
    id: 'basics',
    label: 'Basics',
    area: 'Whole app — window, editor, preview, panels',
    tokens: [
      { key: '--bg', label: 'Background', hint: 'Editor, preview and window background' },
      { key: '--bg-elev', label: 'Panels & sidebars', hint: 'Toolbar, tab bar, sidebars, menus, dialogs' },
      { key: '--text', label: 'Text', hint: 'Body text everywhere, incl. preview headings' },
      { key: '--text-muted', label: 'Secondary text', hint: 'Labels, file tree, status bar, hints' },
      { key: '--accent', label: 'Accent', hint: 'Buttons, selection, cursor, active tab, preview links' },
      { key: '--accent-fg', label: 'Text on accent', hint: 'Text drawn on accent buttons' },
      { key: '--border', label: 'Borders', hint: 'Dividers, panel edges, preview heading rules' },
    ],
  },
  {
    id: 'surfaces',
    label: 'Surfaces & states',
    area: 'App shell — sidebars, toolbar, lists, menus',
    tokens: [
      { key: '--bg-hover', label: 'Hover', hint: 'Rows and buttons under the mouse' },
      { key: '--bg-active', label: 'Selected', hint: 'Selected file, pressed toolbar button' },
      { key: '--bg-soft', label: 'Side panels', hint: 'Find bar, history and side tool panels' },
      { key: '--text-faint', label: 'Faint text', hint: 'Line numbers, placeholders, timestamps' },
      { key: '--danger', label: 'Danger / errors', hint: 'Errors, delete buttons, warnings' },
    ],
  },
  {
    id: 'markdown',
    label: 'Markdown',
    area: 'Editor only (Edit / Live Edit). Preview uses Text, Accent and Borders.',
    tokens: [
      { key: '--md-h1', label: 'Heading 1', hint: '# heading' },
      { key: '--md-h2', label: 'Heading 2', hint: '## heading' },
      { key: '--md-h3', label: 'Heading 3', hint: '### heading' },
      { key: '--md-h4', label: 'Heading 4', hint: '#### heading' },
      { key: '--md-h5', label: 'Heading 5', hint: '##### heading' },
      { key: '--md-h6', label: 'Heading 6', hint: '###### heading' },
      { key: '--md-strong', label: 'Bold', hint: '**bold**' },
      { key: '--md-em', label: 'Italic', hint: '*italic*' },
      { key: '--md-link', label: 'Link', hint: '[link text]' },
      { key: '--md-url', label: 'URL', hint: '(https://…) part of a link' },
      { key: '--md-code', label: 'Inline code', hint: '`inline code`' },
      { key: '--md-code-bg', label: 'Code background', hint: 'Behind inline code and code blocks' },
      { key: '--md-quote', label: 'Blockquote', hint: '> blockquote' },
      { key: '--md-list', label: 'List marker', hint: '- and 1. list markers' },
      { key: '--md-hr', label: 'Horizontal rule', hint: '--- horizontal rule' },
    ],
  },
  {
    id: 'syntax',
    label: 'Code syntax',
    area: 'Code blocks — in the editor and in the preview',
    tokens: [
      { key: '--syn-keyword', label: 'Keyword', hint: 'const, if, return' },
      { key: '--syn-string', label: 'String', hint: '"text"' },
      { key: '--syn-number', label: 'Number', hint: '42, true' },
      { key: '--syn-comment', label: 'Comment', hint: '// comment' },
      { key: '--syn-function', label: 'Function', hint: 'greet()' },
      { key: '--syn-variable', label: 'Variable', hint: 'variable names' },
      { key: '--syn-type', label: 'Type', hint: 'class and type names' },
      { key: '--syn-property', label: 'Property', hint: 'obj.property' },
      { key: '--syn-operator', label: 'Operator', hint: '= + => &&' },
    ],
  },
];

export interface ThemeTokenPair {
  fg: string;
  /** The background `fg` is read on. */
  bg: string;
  label: string;
}

/** Colours that are only ever seen together; the studio edits each pair side by side. */
export const THEME_TOKEN_PAIRS: ThemeTokenPair[] = [
  { fg: '--text', bg: '--bg', label: 'Text on background' },
  { fg: '--accent-fg', bg: '--accent', label: 'Button text on accent' },
  { fg: '--md-code', bg: '--md-code-bg', label: 'Inline code on its background' },
];

export const DEFAULT_RADIUS = 1;
export const MIN_RADIUS = 0;
export const MAX_RADIUS = 2;

export const THEME_TOKEN_KEYS: string[] = THEME_TOKEN_GROUPS.flatMap((g) => g.tokens.map((tk) => tk.key));

export const DEFAULT_GRADIENT_ANGLE = 165;
const GRADIENT_ACCENT_MIX = 0.25;

const HEX6_RE = /^#[0-9a-f]{6}$/i;
const HEX3_RE = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const FALLBACK_COLOR = '#808080';

export function gradientCss(g: BgGradient): string {
  return `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`;
}

/** A starting gradient that stays close to the mode's background. */
export function defaultGradient(palette: Palette): BgGradient {
  const bg = palette['--bg'] ?? FALLBACK_COLOR;
  return { from: bg, to: mix(bg, palette['--accent'] ?? bg, GRADIENT_ACCENT_MIX), angle: DEFAULT_GRADIENT_ANGLE };
}

/** `#abc`, `rgb()`, names … → `#rrggbb` (what `<input type=color>` needs). Alpha is dropped. */
export function toHex6(value: string): string {
  const v = value.trim();
  if (HEX6_RE.test(v)) return v.toLowerCase();
  const short = HEX3_RE.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(v);
  if (rgb) return rgbToHex([Number(rgb[1]), Number(rgb[2]), Number(rgb[3])]);
  return FALLBACK_COLOR;
}

export function isHexColor(value: string): boolean {
  return HEX6_RE.test(value.trim()) || HEX3_RE.test(value.trim());
}

function hexToRgb(hex: string): [number, number, number] {
  const h = toHex6(hex).slice(1);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(rgb: number[]): string {
  return `#${rgb.map((c) => Math.round(Math.max(0, Math.min(255, c))).toString(16).padStart(2, '0')).join('')}`;
}

/** `amount` (0–1) of `b` mixed into `a`. */
export function mix(a: string, b: string, amount: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((c, i) => c + (cb[i] - c) * amount));
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 / 255;
}

function relativeLuminance(hex: string): number {
  const linear = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** WCAG contrast ratio, 1 (none) … 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG AA for body text. */
export const READABLE_CONTRAST = 4.5;

const FLASH_COLORS = ['#ff00c8', '#00e5ff'] as const;

/** A loud colour far from `hex`, for showing where a token is used. */
export function flashColorFor(hex: string): string {
  const [pink, cyan] = FLASH_COLORS;
  return contrastRatio(hex, pink) >= contrastRatio(hex, cyan) ? pink : cyan;
}

const LIGHT_TEXT_ON_ACCENT = '#ffffff';
const DARK_TEXT_ON_ACCENT = '#1a1a1a';
const ACCENT_LUMINANCE_SPLIT = 0.6;

/**
 * Fill every non-basic token from the six basics, so a theme can be made
 * by picking six colours. Syntax colours are left alone — they don't follow
 * from a background and the base theme's set is a better start.
 */
export function harmonize(p: Palette, keep: readonly string[] = []): Palette {
  const { '--bg': bg, '--text': text, '--accent': accent } = p;
  const muted = p['--text-muted'];
  const derived: Palette = {
    '--bg-hover': mix(bg, text, 0.06),
    '--bg-active': mix(bg, text, 0.12),
    '--text-faint': mix(muted, bg, 0.35),
    '--accent-fg': luminance(accent) > ACCENT_LUMINANCE_SPLIT ? DARK_TEXT_ON_ACCENT : LIGHT_TEXT_ON_ACCENT,
    '--md-h1': text,
    '--md-h2': text,
    '--md-h3': mix(text, muted, 0.3),
    '--md-h4': mix(text, muted, 0.6),
    '--md-h5': muted,
    '--md-h6': mix(muted, bg, 0.2),
    '--md-strong': text,
    '--md-em': text,
    '--md-link': accent,
    '--md-url': mix(accent, text, 0.3),
    '--md-code': accent,
    '--md-code-bg': p['--bg-elev'],
    '--md-quote': muted,
    '--md-list': accent,
    '--md-hr': p['--border'],
    '--bg-soft': p['--bg-elev'],
  };
  return mergeKeeping(p, derived, keep);
}

/** `incoming` over `current`, except the `keep` tokens, which stay as they are. */
export function mergeKeeping(current: Palette, incoming: Palette, keep: readonly string[]): Palette {
  const out: Palette = { ...current, ...incoming };
  for (const key of keep) if (current[key]) out[key] = current[key];
  return out;
}

function normalizePalette(raw: unknown): Palette {
  const out: Palette = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const key of THEME_TOKEN_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === 'string' && isHexColor(v)) out[key] = toHex6(v);
  }
  return out;
}

/** Keep only well-formed themes from a persisted (possibly tampered) blob. */
export function normalizeUserThemes(raw: unknown): UserTheme[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((t): t is Record<string, unknown> => !!t && typeof t === 'object')
    .filter((t) => typeof t.id === 'string' && t.id && typeof t.name === 'string')
    .map((t) => ({
      id: t.id as string,
      name: (t.name as string).slice(0, 80),
      light: normalizePalette(t.light),
      dark: normalizePalette(t.dark),
      edited: normalizeEdited(t.edited),
      radius: normalizeRadius(t.radius),
      gradient: normalizeGradients(t.gradient),
    }));
}

/** Themes saved before backdrops existed never touched the background, so they keep it. */
function normalizeGradient(raw: unknown): Backdrop {
  if (raw === undefined || raw === KEEP_CSS_BACKDROP) return KEEP_CSS_BACKDROP;
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Record<string, unknown>;
  if (typeof g.from !== 'string' || !isHexColor(g.from) || typeof g.to !== 'string' || !isHexColor(g.to)) return null;
  const angle = typeof g.angle === 'number' && Number.isFinite(g.angle) ? g.angle : DEFAULT_GRADIENT_ANGLE;
  return { from: toHex6(g.from), to: toHex6(g.to), angle: Math.round(angle) % 360 };
}

function normalizeGradients(raw: unknown): Record<ThemeMode, Backdrop> {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { light: normalizeGradient(r.light), dark: normalizeGradient(r.dark) };
}

function normalizeRadius(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_RADIUS;
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, raw));
}

function normalizeEdited(raw: unknown): EditedTokens {
  const pick = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string' && THEME_TOKEN_KEYS.includes(k)) : [];
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return { light: pick(r.light), dark: pick(r.dark) };
}

export function newUserThemeId(): string {
  return `ut-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
