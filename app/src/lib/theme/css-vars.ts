import { parseTheme, type BackdropLayer, type ThemeMode, type Variant } from './schema.ts';
import { MAX_BACKDROP_LAYERS, SECTION_COLOR_VARS, SECTION_IDS, type SectionId } from './tokens.ts';

const MIN_LINEAR_STOPS = 2;
import { isLight } from './color.ts';

export type CssRule = { selectors: string[]; decls: Record<string, string> };

const COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const DECL_SPLIT_RE = /;(?![^(]*\))/;
const ROOT_THEME_RE = /^:root\[data-theme=["']?([a-z0-9-]+)["']?\]$/i;
const RADIAL_RE = /^radial-gradient\(\s*circle at ([\d.]+)% ([\d.]+)%,\s*(.+?),\s*transparent ([\d.]+)%\s*\)$/i;
const LINEAR_RE = /^linear-gradient\(\s*([\d.]+)deg,\s*(.+)\)$/i;
const STOP_RE = /^(.+?)\s+([\d.]+)%$/;
const PROBE_BASE = '#000000';
const HANDLED_VARS = new Set(['--bg-grad', '--r-md']);

function parseDecls(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of body.split(DECL_SPLIT_RE)) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim().replace(/\s+/g, ' ');
  }
  return out;
}

function blockEnd(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return i;
  }
  return css.length;
}

function nextRule(css: string, from: number): { rule: CssRule | null; end: number } {
  const open = css.indexOf('{', from);
  const semi = css.indexOf(';', from);
  const head = css.slice(from).trimStart();
  if (head.startsWith('@') && semi !== -1 && (open === -1 || semi < open)) {
    return { rule: { selectors: [css.slice(from, semi).trim()], decls: {} }, end: semi + 1 };
  }
  if (open === -1) return { rule: null, end: css.length };
  const end = blockEnd(css, open);
  const prelude = css.slice(from, open).trim();
  const body = css.slice(open + 1, end);
  if (prelude.startsWith('@')) return { rule: { selectors: [prelude], decls: {} }, end: end + 1 };
  const selectors = prelude.split(',').map((x) => x.trim()).filter(Boolean);
  return { rule: { selectors, decls: parseDecls(body) }, end: end + 1 };
}

export function parseRules(css: string): CssRule[] {
  const clean = css.replace(COMMENT_RE, '');
  const rules: CssRule[] = [];
  for (let pos = 0; pos < clean.length;) {
    const { rule, end } = nextRule(clean, pos);
    if (rule?.selectors.length) rules.push(rule);
    pos = end;
  }
  return rules;
}

export function modeSelectorsOf(rule: CssRule): string[] {
  return rule.selectors.map((s) => (s === ':root' ? 'base' : ROOT_THEME_RE.exec(s)?.[1] ?? s));
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth++;
    if (value[i] === ')') depth--;
    if (value[i] === ',' && depth === 0) { parts.push(value.slice(start, i).trim()); start = i + 1; }
  }
  return [...parts, value.slice(start).trim()].filter(Boolean);
}

function parseLayer(part: string): BackdropLayer | null {
  const r = RADIAL_RE.exec(part);
  if (r) return { kind: 'radial', x: Number(r[1]), y: Number(r[2]), color: r[3].trim(), fade: Number(r[4]) };
  const l = LINEAR_RE.exec(part);
  if (!l) return null;
  const stops = splitTopLevel(l[2]).map((s) => STOP_RE.exec(s));
  if (stops.length < MIN_LINEAR_STOPS || stops.some((m) => !m)) return null;
  return { kind: 'linear', angle: Number(l[1]), stops: stops.map((m) => ({ color: m![1].trim(), at: Number(m![2]) })) };
}

export function parseBackdrop(value: string): BackdropLayer[] | null {
  const layers = splitTopLevel(value).map(parseLayer);
  const isValid = layers.length > 0 && layers.length <= MAX_BACKDROP_LAYERS;
  return isValid && layers.every((x): x is BackdropLayer => !!x) ? layers : null;
}

const VAR_TO_KEY: Record<string, [SectionId, string]> = Object.fromEntries(
  SECTION_IDS.flatMap((section) =>
    Object.entries(SECTION_COLOR_VARS[section]).map(([key, cssVar]) => [cssVar, [section, key]])),
);

function isAllowedColor(value: string): boolean {
  const probe = {
    id: 'probe', name: 'probe', version: 1, source: 'mine',
    variants: { probe: { mode: 'dark', app: { colors: { bg: value, text: PROBE_BASE, accent: PROBE_BASE } } } },
  };
  return parseTheme(probe).ok;
}

export function varsToVariant(vars: Record<string, string>, mode?: ThemeMode): { variant: Variant; dropped: string[] } {
  const sections: Record<string, { colors: Record<string, string> }> = {};
  const dropped: string[] = [];
  for (const [name, value] of Object.entries(vars)) {
    const target = VAR_TO_KEY[name];
    if (!target || !isAllowedColor(value)) {
      if (name.startsWith('--') && !HANDLED_VARS.has(name)) dropped.push(name);
      continue;
    }
    (sections[target[0]] ??= { colors: {} }).colors[target[1]] = value;
  }
  const bg = sections.app?.colors.bg ?? '';
  const resolvedMode: ThemeMode = mode ?? (isLight(bg) ? 'light' : 'dark');
  return { variant: { mode: resolvedMode, ...sections } as Variant, dropped };
}
