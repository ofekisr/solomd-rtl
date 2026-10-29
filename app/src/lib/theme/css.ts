import type { BackdropLayer, TextStyle } from './schema.ts';
import type { ResolvedVariant } from './resolve.ts';
import { SECTION_COLOR_VARS, SECTION_IDS } from './tokens.ts';

export const THEME_SELECTOR = 'html:root[data-theme]';
export const SHOW_THROUGH = [
  '.app', '.pane-host', '.preview-host', '.cm-host', '.plain-editor', '.pane--editor', '.pane--preview',
  '.toolbar', '.statusbar', '.ftree', '.outline', '.side-sidebar', '.pane-tabbar',
] as const;

const RADIUS_PX = { '--r-sm': 4, '--r-md': 8, '--r-lg': 12 } as const;
const NODE_RADIUS_PX = 5;
const PERCENT = 100;
const STYLED_TOKENS = {
  '--md-heading': 'heading', '--md-link': 'link', '--md-quote': 'quote',
  '--syn-comment': 'comment', '--syn-keyword': 'keyword', '--syn-function': 'function', '--syn-string': 'string',
} as const;

function colorVars(r: ResolvedVariant): Record<string, string> {
  const out: Record<string, string> = {};
  for (const section of SECTION_IDS) {
    const map = SECTION_COLOR_VARS[section] as Record<string, string>;
    const colors = r.colors[section] as Record<string, string>;
    for (const [key, cssVar] of Object.entries(map)) out[cssVar] = colors[key];
  }
  return out;
}

function textStyleVars(prefix: string, s: TextStyle): Record<string, string> {
  return {
    [`${prefix}-style`]: s.italic ? 'italic' : 'normal',
    [`${prefix}-weight`]: s.bold ? 'bold' : 'normal',
    [`${prefix}-decoration`]: s.underline ? 'underline' : 'none',
  };
}

function styleVars(r: ResolvedVariant): Record<string, string> {
  const s = r.style;
  const out: Record<string, string> = {
    '--bg-grad': s.backdrop.length ? backdropCss(s.backdrop) : 'none',
    '--panel-opacity': `${Math.round(s.panelOpacity * PERCENT)}%`,
    '--panel-blur': `${s.panelBlur}px`,
    '--dg-node-radius': `${s.nodeRadius * NODE_RADIUS_PX}px`,
  };
  for (const [cssVar, px] of Object.entries(RADIUS_PX)) out[cssVar] = `${px * s.radius}px`;
  for (const [prefix, key] of Object.entries(STYLED_TOKENS)) Object.assign(out, textStyleVars(prefix, s[key]));
  return out;
}

export function themeVars(r: ResolvedVariant): Record<string, string> {
  const vars = { ...colorVars(r), ...styleVars(r) };
  if (!r.style.activeLine) vars['--cm-active-line'] = 'transparent';
  return vars;
}

function layerCss(layer: BackdropLayer): string {
  if (layer.kind === 'radial') return `radial-gradient(circle at ${layer.x}% ${layer.y}%, ${layer.color}, transparent ${layer.fade}%)`;
  return `linear-gradient(${layer.angle}deg, ${layer.stops.map((st) => `${st.color} ${st.at}%`).join(', ')})`;
}

export function backdropCss(layers: BackdropLayer[]): string {
  return layers.map(layerCss).join(', ');
}

function showThroughCss(): string {
  return [
    `${THEME_SELECTOR} body {\n  background-image: var(--bg-grad);\n}`,
    `${THEME_SELECTOR} :is(${SHOW_THROUGH.join(', ')}) {\n` +
      '  background: color-mix(in srgb, var(--bg-elev) var(--panel-opacity), transparent) !important;\n' +
      '  backdrop-filter: blur(var(--panel-blur));\n}',
  ].join('\n\n');
}

export function themeCss(r: ResolvedVariant): string {
  const decls = Object.entries(themeVars(r)).map(([k, v]) => `  ${k}: ${v};`);
  const root = `${THEME_SELECTOR} {\n  color-scheme: ${r.mode};\n${decls.join('\n')}\n}`;
  return r.style.backdrop.length ? `${root}\n\n${showThroughCss()}` : root;
}
