import { initMermaid } from '../mermaid-lazy.ts';
import { renderDot } from '../graphviz.ts';

// v4.3.0 issue #57a — live-render math + Mermaid blocks in the editor.
// Mermaid is async; we render lazily into a counter-keyed cache so the
// widget toDOM() can pull a ready SVG without re-rendering. The cache is
// keyed on theme + source text → SVG so the same diagram across multiple panes
// renders once per theme.
//
// #354: this used to render with theme 'default' always, so in a dark theme
// the diagram's dark lines and labels sat on the dark editor background and
// all but vanished. The theme now comes from the editor (same mapping as
// preview), and it's part of the key, so switching theme renders fresh SVG
// instead of reusing the light one.
export type MermaidTheme = 'dark' | 'default';
export const mermaidSvgCache = new Map<string, { svg: string | null; error: string | null }>();
let mermaidIdSeq = 0;
export const mermaidKey = (source: string, theme: MermaidTheme) => `${theme}\u0000${source}`;
// In-flight renders. A second caller has to wait for the same render, not
// return straight away: the widget's toDOM relies on the promise resolving
// only once the SVG is in the cache, to trigger the rebuild that swaps the
// "Rendering…" placeholder for the diagram. Returning early made that rebuild
// run before the render finished, and the placeholder stayed for good.
export const mermaidInflight = new Map<string, Promise<void>>();
export function ensureMermaidRendered(source: string, theme: MermaidTheme): Promise<void> {
  const key = mermaidKey(source, theme);
  const pending = mermaidInflight.get(key);
  if (pending) return pending;
  if (mermaidSvgCache.has(key)) return Promise.resolve();
  // Reserve the slot first so concurrent calls don't double-render.
  mermaidSvgCache.set(key, { svg: null, error: null });
  const job = (async () => {
    try {
      const id = `cm-mmd-${++mermaidIdSeq}`;
      const mermaid = await initMermaid({
        startOnLoad: false,
        securityLevel: 'strict',
        theme,
      });
      const { svg } = await mermaid.render(id, source);
      mermaidSvgCache.set(key, { svg, error: null });
    } catch (e) {
      mermaidSvgCache.set(key, { svg: null, error: (e as Error).message });
    } finally {
      mermaidInflight.delete(key);
    }
  })();
  mermaidInflight.set(key, job);
  return job;
}

// ```dot / ```graphviz / ```gv — same cache-then-relayout model as mermaid,
// keyed by theme so a theme switch renders fresh SVG.
export const graphvizSvgCache = new Map<string, { svg: string | null; error: string | null }>();
export const graphvizInflight = new Map<string, Promise<void>>();
export function ensureGraphvizRendered(source: string, theme: MermaidTheme): Promise<void> {
  const key = mermaidKey(source, theme);
  const pending = graphvizInflight.get(key);
  if (pending) return pending;
  if (graphvizSvgCache.has(key)) return Promise.resolve();
  graphvizSvgCache.set(key, { svg: null, error: null });
  const job = renderDot(source, theme)
    .then((svg) => { graphvizSvgCache.set(key, { svg, error: null }); })
    .catch((e: Error) => { graphvizSvgCache.set(key, { svg: null, error: e.message }); })
    .finally(() => { graphvizInflight.delete(key); });
  graphvizInflight.set(key, job);
  return job;
}
