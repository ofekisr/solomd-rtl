import { parseTheme, type Theme, type Variant } from './schema.ts';
import { modeSelectorsOf, parseBackdrop, parseRules, varsToVariant, type CssRule } from './css-vars.ts';
import { SHOW_THROUGH } from './css.ts';

type Meta = { id: string; name: string; author?: string };
type VarSets = Record<string, Record<string, string>>;
const SHOW_THROUGH_MIN_MATCHES = 3;
const BLUR_RE = /blur\(([\d.]+)px\)/;
const RADIUS_BASE_PX = 8;
const HANDLED_SELECTORS = new Set(['body']);
const VAR_MODES = new Set(['base', 'light', 'dark']);

function isVarBlock(rule: CssRule): boolean {
  return modeSelectorsOf(rule).every((m) => VAR_MODES.has(m));
}

function isShowThrough(rule: CssRule): boolean {
  const hits = rule.selectors.filter((s) => (SHOW_THROUGH as readonly string[]).includes(s)).length;
  const background = rule.decls.background ?? rule.decls['background-color'] ?? '';
  return hits >= SHOW_THROUGH_MIN_MATCHES && /transparent/.test(background);
}

function collectVars(rules: CssRule[]): VarSets {
  const byMode: VarSets = {};
  for (const rule of rules.filter(isVarBlock)) {
    for (const m of modeSelectorsOf(rule)) Object.assign((byMode[m] ??= {}), rule.decls);
  }
  return byMode;
}

function candidateSets(byMode: VarSets): Record<string, string>[] {
  const base = byMode.base ?? {};
  const modes = ['light', 'dark'].filter((m) => byMode[m]);
  return modes.length ? modes.map((m) => ({ ...base, ...byMode[m] })) : [base];
}

function variantsFrom(byMode: VarSets): { variants: Record<string, Variant>; dropped: string[] } {
  const converted = candidateSets(byMode).map((vars) => varsToVariant(vars));
  const variants: Record<string, Variant> = {};
  for (const c of converted) variants[c.variant.mode] ??= c.variant;
  return { variants, dropped: [...new Set(converted.flatMap((c) => c.dropped))] };
}

function applyStyles(variants: Record<string, Variant>, rules: CssRule[], vars: Record<string, string>): void {
  const backdrop = vars['--bg-grad'] ? parseBackdrop(vars['--bg-grad']) : null;
  const hasShowThrough = rules.some(isShowThrough);
  const blur = rules.map((r) => BLUR_RE.exec(r.decls['backdrop-filter'] ?? '')).find(Boolean);
  const radiusPx = vars['--r-md'] ? Number.parseFloat(vars['--r-md']) : Number.NaN;
  for (const v of Object.values(variants)) {
    const style = {
      ...(backdrop ? { backdrop } : {}),
      ...(hasShowThrough ? { panelOpacity: 0 } : {}),
      ...(blur ? { panelBlur: Number(blur[1]) } : {}),
    };
    if (Object.keys(style).length) v.surfaces = { ...v.surfaces, style };
    if (!Number.isNaN(radiusPx)) v.app = { ...v.app, style: { radius: radiusPx / RADIUS_BASE_PX } };
  }
}

function droppedRules(rules: CssRule[]): string[] {
  return rules
    .filter((r) => !isVarBlock(r) && !isShowThrough(r) && !r.selectors.every((s) => HANDLED_SELECTORS.has(s)))
    .map((r) => r.selectors.join(', '));
}

export function convertMarketplaceCss(css: string, meta: Meta): { theme: Theme; dropped: string[] } {
  const rules = parseRules(css);
  const byMode = collectVars(rules);
  const { variants, dropped } = variantsFrom(byMode);
  applyStyles(variants, rules, { ...byMode.base, ...byMode.dark, ...byMode.light });
  const parsed = parseTheme({ ...meta, version: 1, source: 'mine', origin: 'marketplace', variants });
  if (!parsed.ok) throw new Error(`${meta.name}: ${parsed.error}`);
  return { theme: parsed.theme, dropped: [...droppedRules(rules), ...dropped] };
}
