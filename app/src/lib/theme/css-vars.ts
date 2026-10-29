import { parseTheme, type BackdropLayer, type ThemeMode, type Variant } from './schema.ts';
import { SECTION_COLOR_VARS, SECTION_IDS, type SectionId } from './tokens.ts';
import { isLight } from './color.ts';

export type CssRule = { selectors: string[]; decls: Record<string, string> };

const COMMENT_RE = /\/\*[\s\S]*?\*\//g;
const RULE_RE = /([^{}]+)\{([^{}]*)\}/g;
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

export function parseRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  for (const m of css.replace(COMMENT_RE, '').matchAll(RULE_RE)) {
    rules.push({ selectors: m[1].split(',').map((s) => s.trim()).filter(Boolean), decls: parseDecls(m[2]) });
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
  const stops = splitTopLevel(l[2]).map((s) => STOP_RE.exec(s)).filter((m): m is RegExpExecArray => !!m);
  return { kind: 'linear', angle: Number(l[1]), stops: stops.map((m) => ({ color: m[1].trim(), at: Number(m[2]) })) };
}

export function parseBackdrop(value: string): BackdropLayer[] | null {
  const layers = splitTopLevel(value).map(parseLayer);
  return layers.every((x): x is BackdropLayer => !!x) ? layers : null;
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
