import { WidgetType } from '@codemirror/view';
import { type DiagramKind } from '../cm/fence-modes.ts';
import { type MermaidTheme, mermaidSvgCache, mermaidKey, ensureMermaidRendered, graphvizSvgCache, ensureGraphvizRendered } from './diagram-cache.ts';

// v4.3.0 issue #57a — mermaid fenced blocks. Mermaid is async so we render
// into a module-level cache; toDOM() pulls the SVG when available, falls
// back to a "rendering…" placeholder, then dispatches `solomd:cm-relayout`
// to ask the editor to rebuild decorations once the cache fills.
export class MermaidWidget extends WidgetType {
  /** Whether the cache held a finished result when this widget was built. */
  private readonly settled: boolean;

  constructor(
    private readonly source: string,
    private readonly theme: MermaidTheme,
  ) {
    super();
    const cached = mermaidSvgCache.get(mermaidKey(source, theme));
    this.settled = !!(cached && (cached.svg || cached.error));
  }

  eq(other: MermaidWidget): boolean {
    // A theme change must remount the widget with the other theme's SVG. So
    // must the render finishing: if the placeholder and the finished widget
    // compared equal, CodeMirror would keep the "Rendering…" DOM.
    return (
      other.source === this.source &&
      other.theme === this.theme &&
      other.settled === this.settled
    );
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-live-block cm-live-block--mermaid';
    const cached = mermaidSvgCache.get(mermaidKey(this.source, this.theme));
    if (cached?.svg) {
      wrap.innerHTML = cached.svg;
    } else if (cached?.error) {
      wrap.classList.add('cm-live-block--broken');
      wrap.textContent = `Mermaid: ${cached.error}`;
    } else {
      wrap.textContent = '⌛ Rendering Mermaid…';
      ensureMermaidRendered(this.source, this.theme).then(() => {
        // Ask the field to recompute now that the SVG cache is filled. We
        // can't hold an EditorView here (block decorations live in a state
        // field, built without a view), so signal via a window event that
        // the companion relayout plugin turns into a `relayoutEffect`.
        try {
          window.dispatchEvent(new CustomEvent('solomd:cm-relayout'));
        } catch {}
      });
    }
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export class GraphvizWidget extends WidgetType {
  private readonly settled: boolean;

  constructor(
    private readonly source: string,
    private readonly theme: MermaidTheme,
  ) {
    super();
    const cached = graphvizSvgCache.get(mermaidKey(source, theme));
    this.settled = !!(cached && (cached.svg || cached.error));
  }

  eq(other: GraphvizWidget): boolean {
    return other.source === this.source && other.theme === this.theme && other.settled === this.settled;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-live-block cm-live-block--graphviz';
    const cached = graphvizSvgCache.get(mermaidKey(this.source, this.theme));
    if (cached?.svg) {
      wrap.innerHTML = cached.svg;
    } else if (cached?.error) {
      wrap.classList.add('cm-live-block--broken');
      wrap.textContent = `Graphviz: ${cached.error}`;
    } else {
      wrap.textContent = '⌛ Rendering Graphviz…';
      ensureGraphvizRendered(this.source, this.theme).then(() => {
        try {
          window.dispatchEvent(new CustomEvent('solomd:cm-relayout'));
        } catch {}
      });
    }
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// v4.10 issue #163 — ```plantuml fence rendered via the configured PlantUML
// server (opt-in; see lib/plantuml.ts for the privacy story). Same reveal
// model as mermaid/tables: cursor inside → source. The <img> reports its
// final size only after load, so onload nudges the relayout plugin to make
// CM re-measure the block height.
export class PlantumlWidget extends WidgetType {
  constructor(
    readonly source: string,
    readonly url: string,
  ) {
    super();
  }

  eq(other: PlantumlWidget): boolean {
    return other.source === this.source && other.url === this.url;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-live-block cm-live-block--plantuml';
    const img = document.createElement('img');
    img.alt = 'PlantUML diagram';
    img.src = this.url;
    img.addEventListener('load', () => {
      try {
        window.dispatchEvent(new CustomEvent('solomd:cm-relayout'));
      } catch {}
    });
    img.addEventListener('error', () => {
      wrap.classList.add('cm-live-block--broken');
      wrap.textContent = 'PlantUML render failed — check the server setting';
      try {
        window.dispatchEvent(new CustomEvent('solomd:cm-relayout'));
      } catch {}
    });
    wrap.appendChild(img);
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export function diagramWidget(kind: DiagramKind, body: string, theme: MermaidTheme): WidgetType {
  if (kind === 'mermaid') {
    ensureMermaidRendered(body, theme);
    return new MermaidWidget(body, theme);
  }
  ensureGraphvizRendered(body, theme);
  return new GraphvizWidget(body, theme);
}
