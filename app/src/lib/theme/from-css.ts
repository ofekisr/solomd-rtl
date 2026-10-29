import { parseTheme, type Theme, type Variant } from './schema.ts';
import { modeSelectorsOf, parseBackdrop, parseRules, varsToVariant, type CssRule } from './css-vars.ts';
import { SHOW_THROUGH } from './css.ts';
import { MAX_ROUNDNESS, MIN_ROUNDNESS } from './tokens.ts';

type Meta = { id: string; name: string; author?: string };
type SharedStyle = { hasShowThrough: boolean; blur?: number };
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

type Converted = { variant: Variant; vars: Record<string, string> };

function variantsFrom(byMode: VarSets): { items: Converted[]; dropped: string[] } {
  const converted = candidateSets(byMode).map((vars) => ({ ...varsToVariant(vars), vars }));
  const byKey = new Map<string, Converted>();
  for (const c of converted) if (!byKey.has(c.variant.mode)) byKey.set(c.variant.mode, c);
  return { items: [...byKey.values()], dropped: [...new Set(converted.flatMap((c) => c.dropped))] };
}

function radiusOf(vars: Record<string, string>): { radius?: number; failed: boolean } {
  if (!vars['--r-md']) return { failed: false };
  const radius = Number.parseFloat(vars['--r-md']) / RADIUS_BASE_PX;
  const isValid = Number.isFinite(radius) && radius >= MIN_ROUNDNESS && radius <= MAX_ROUNDNESS;
  return isValid ? { radius, failed: false } : { failed: true };
}

function applyStyles(variant: Variant, vars: Record<string, string>, shared: SharedStyle): string[] {
  const dropped: string[] = [];
  const backdrop = vars['--bg-grad'] ? parseBackdrop(vars['--bg-grad']) : null;
  if (vars['--bg-grad'] && !backdrop) dropped.push('--bg-grad');
  const { radius, failed } = radiusOf(vars);
  if (failed) dropped.push('--r-md');
  const style = {
    ...(backdrop ? { backdrop } : {}),
    ...(shared.hasShowThrough ? { panelOpacity: 0 } : {}),
    ...(shared.blur !== undefined ? { panelBlur: shared.blur } : {}),
  };
  if (Object.keys(style).length) variant.surfaces = { ...variant.surfaces, style };
  if (radius !== undefined) variant.app = { ...variant.app, style: { radius } };
  return dropped;
}

function sharedStyle(rules: CssRule[]): SharedStyle {
  const hit = rules.map((r) => BLUR_RE.exec(r.decls['backdrop-filter'] ?? '')).find(Boolean);
  return { hasShowThrough: rules.some(isShowThrough), blur: hit ? Number(hit[1]) : undefined };
}

function droppedRules(rules: CssRule[]): string[] {
  return rules
    .filter((r) => !isVarBlock(r) && !isShowThrough(r) && !r.selectors.every((s) => HANDLED_SELECTORS.has(s)))
    .map((r) => r.selectors.join(', '));
}

export function convertMarketplaceCss(css: string, meta: Meta): { theme: Theme; dropped: string[] } {
  const rules = parseRules(css);
  const { items, dropped } = variantsFrom(collectVars(rules));
  const shared = sharedStyle(rules);
  const styleDropped = items.flatMap((i) => applyStyles(i.variant, i.vars, shared));
  const variants = Object.fromEntries(items.map((i) => [i.variant.mode, i.variant]));
  const parsed = parseTheme({ ...meta, version: 1, source: 'mine', origin: 'marketplace', variants });
  if (!parsed.ok) throw new Error(`${meta.name}: ${parsed.error}`);
  return { theme: parsed.theme, dropped: [...droppedRules(rules), ...dropped, ...new Set(styleDropped)] };
}
