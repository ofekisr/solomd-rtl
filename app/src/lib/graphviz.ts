/**
 * Graphviz (```dot / ```graphviz / ```gv fences), rendered locally by the
 * viz.js WASM build — no server, so it works offline like mermaid does.
 *
 * The renderer (~1.4 MB with its embedded WASM) loads the first time a note
 * actually contains a graph, same as `mermaid-lazy.ts`.
 *
 * DOT can carry `URL` / `href` attributes, which become `<a xlink:href>` in
 * the SVG — so the output goes through the app's sanitizer before it is
 * injected anywhere.
 */
import type { Attributes, Viz } from '@viz-js/viz';
import { sanitizeRenderedHtml } from './sanitize-html.ts';

export type GraphvizTheme = 'dark' | 'default';

const GRAPHVIZ_LANGS: ReadonlySet<string> = new Set(['dot', 'graphviz', 'gv']);

export const GRAPHVIZ_SELECTOR = Array.from(GRAPHVIZ_LANGS, (l) => `pre > code.language-${l}`).join(', ');

export function isGraphvizLang(lang: string): boolean {
  return GRAPHVIZ_LANGS.has(lang.toLowerCase());
}

const DARK_INK = '#d4d4d4';

let loading: Promise<Viz> | null = null;

function loadViz(): Promise<Viz> {
  if (!loading) loading = import('@viz-js/viz').then((m) => m.instance());
  return loading;
}

/**
 * Render DOT source to a sanitized SVG string. Throws with Graphviz's own
 * message on a syntax error. Explicit colours in the source always win over
 * the theme defaults applied here.
 */
export async function renderDot(source: string, theme: GraphvizTheme = 'default'): Promise<string> {
  const viz = await loadViz();
  const ink: Attributes = theme === 'dark' ? { color: DARK_INK, fontcolor: DARK_INK } : {};
  const svg = viz.renderString(source, {
    format: 'svg',
    graphAttributes: { bgcolor: 'transparent', ...ink },
    nodeAttributes: ink,
    edgeAttributes: ink,
  });
  return sanitizeRenderedHtml(svg.slice(svg.search(/<svg[\s>]/i)));
}

export interface GraphvizBlockOptions {
  theme?: GraphvizTheme;
  blockClass?: string;
  errorClass?: string;
  /** Keep the fence as code (instead of an error block) when a graph fails. */
  isSilent?: boolean;
}

/**
 * Swap every Graphviz fence under `root` for its SVG. A root with no such
 * fence returns without loading the renderer.
 */
export async function renderGraphvizBlocks(root: ParentNode, opts: GraphvizBlockOptions = {}): Promise<void> {
  const blocks = root.querySelectorAll(GRAPHVIZ_SELECTOR);
  for (const block of Array.from(blocks)) {
    const pre = block.parentElement as HTMLElement | null;
    if (!pre || pre.dataset.rendered === '1') continue;
    pre.dataset.rendered = '1';
    const code = (block.textContent || '').trim();
    try {
      const wrap = document.createElement('div');
      wrap.className = opts.blockClass ?? 'graphviz-block';
      wrap.dataset.graphvizSource = code;
      wrap.innerHTML = await renderDot(code, opts.theme);
      pre.replaceWith(wrap);
    } catch (e) {
      if (opts.isSilent) continue;
      const err = document.createElement('pre');
      err.className = opts.errorClass ?? 'graphviz-error';
      err.textContent = `Graphviz error: ${(e as Error).message}`;
      pre.replaceWith(err);
    }
  }
}
