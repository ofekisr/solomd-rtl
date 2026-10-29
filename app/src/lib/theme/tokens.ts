export const SECTION_COLOR_VARS = {
  app: {
    bg: '--bg', text: '--text', textMuted: '--text-muted', textFaint: '--text-faint',
    accent: '--accent', accentFg: '--accent-fg', danger: '--danger',
  },
  surfaces: { panel: '--bg-elev', hover: '--bg-hover', active: '--bg-active', soft: '--bg-soft', border: '--border' },
  markdown: {
    h1: '--md-h1', h2: '--md-h2', h3: '--md-h3', h4: '--md-h4', h5: '--md-h5', h6: '--md-h6',
    strong: '--md-strong', em: '--md-em', link: '--md-link', url: '--md-url', code: '--md-code',
    codeBg: '--md-code-bg', quote: '--md-quote', list: '--md-list', hr: '--md-hr',
  },
  code: {
    keyword: '--syn-keyword', string: '--syn-string', number: '--syn-number', comment: '--syn-comment',
    function: '--syn-function', variable: '--syn-variable', type: '--syn-type', property: '--syn-property',
    operator: '--syn-operator', punctuation: '--syn-punctuation', tag: '--syn-tag', attribute: '--syn-attribute',
    regexp: '--syn-regexp', constant: '--syn-constant', invalid: '--syn-invalid',
  },
  editor: {
    background: '--cm-bg', gutterBg: '--cm-gutter-bg', gutterFg: '--cm-gutter-fg', activeLine: '--cm-active-line',
    selection: '--cm-selection', cursor: '--cm-cursor', bracket: '--cm-bracket', search: '--cm-search',
    searchActive: '--cm-search-active',
  },
  diagrams: { nodeBg: '--dg-node-bg', nodeBorder: '--dg-node-border', line: '--dg-line', text: '--dg-text' },
} as const;

export type SectionId = keyof typeof SECTION_COLOR_VARS;
export type ColorKey<S extends SectionId> = keyof (typeof SECTION_COLOR_VARS)[S];
export const SECTION_IDS = Object.keys(SECTION_COLOR_VARS) as SectionId[];

export const MIN_ROUNDNESS = 0;
export const MAX_ROUNDNESS = 2;
export const DEFAULT_ROUNDNESS = 1;
export const MAX_BACKDROP_LAYERS = 8;
export const MAX_PANEL_BLUR_PX = 40;
export const MAX_NAME_LENGTH = 80;
export const MAX_ID_LENGTH = 64;
export const ID_RE = /^[a-z0-9_-]+$/i;
