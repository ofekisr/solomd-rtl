import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseRules, modeSelectorsOf, varsToVariant } from '../../src/lib/theme/css-vars.ts';
import { parseTheme, type Variant } from '../../src/lib/theme/schema.ts';
import { LEGACY_TO_SLOT, BUILTIN_NAMES, type LegacyTheme } from '../../src/lib/theme/legacy.ts';

const MAIN_CSS = new URL('../../src/styles/main.css', import.meta.url);
const OUT_DIR = new URL('../../src/lib/theme/builtin/', import.meta.url);
const JSON_INDENT = 2;
const THEME_VERSION = 1;

type Chrome = { background: string; gutterFg: string; selection: string; cursor: string; activeLine?: string };
const CHROME: Partial<Record<LegacyTheme, Chrome>> = {
  dark: { background: '#282c34', gutterFg: '#7d8799', selection: '#3E4451', cursor: '#528bff', activeLine: '#2c313a' },
  nord: { background: '#2e3440', gutterFg: '#4c566a', selection: 'rgba(136,192,208,0.2)', cursor: '#88c0d0' },
  'solarized-light': { background: '#fdf6e3', gutterFg: '#93a1a1', selection: 'rgba(38,139,210,0.15)', cursor: '#268bd2' },
  'solarized-dark': { background: '#002b36', gutterFg: '#586e75', selection: 'rgba(38,139,210,0.2)', cursor: '#268bd2' },
  monokai: { background: '#272822', gutterFg: '#75715e', selection: 'rgba(249,38,114,0.18)', cursor: '#f92672' },
  'github-light': { background: '#ffffff', gutterFg: '#babbbc', selection: 'rgba(3,102,214,0.12)', cursor: '#0366d6' },
  dracula: { background: '#282a36', gutterFg: '#6272a4', selection: 'rgba(189,147,249,0.18)', cursor: '#bd93f9' },
};

function varsByLegacyName(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const rule of parseRules(readFileSync(MAIN_CSS, 'utf8'))) {
    for (const m of modeSelectorsOf(rule)) {
      if (m === 'base') Object.assign((out.light ??= {}), rule.decls);
      else if (m in LEGACY_TO_SLOT) Object.assign((out[m] ??= {}), rule.decls);
    }
  }
  return out;
}

function variantFor(name: LegacyTheme, vars: Record<string, string>): Variant {
  const { variant } = varsToVariant(vars, LEGACY_TO_SLOT[name].variant);
  const chrome = CHROME[name];
  if (!chrome) return variant;
  const { background, gutterFg, selection, cursor, activeLine } = chrome;
  return { ...variant, editor: { colors: { background, gutterBg: background, gutterFg, selection, cursor, ...(activeLine ? { activeLine } : {}) } } };
}

function groupVariants(): Record<string, { variants: Record<string, Variant> }> {
  const vars = varsByLegacyName();
  const themes: Record<string, { variants: Record<string, Variant> }> = {};
  for (const name of Object.keys(LEGACY_TO_SLOT) as LegacyTheme[]) {
    const { themeId, variant } = LEGACY_TO_SLOT[name];
    (themes[themeId] ??= { variants: {} }).variants[variant] = variantFor(name, { ...vars.light, ...vars[name] });
  }
  return themes;
}

function writeTheme(id: string, variants: Record<string, Variant>): void {
  const parsed = parseTheme({ id, name: BUILTIN_NAMES[id], version: THEME_VERSION, source: 'builtin', variants });
  if (!parsed.ok) throw new Error(`${id}: ${parsed.error}`);
  writeFileSync(new URL(`${id}.json`, OUT_DIR), `${JSON.stringify(parsed.theme, null, JSON_INDENT)}\n`);
}

function build(): void {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [id, { variants }] of Object.entries(groupVariants())) writeTheme(id, variants);
}

build();
