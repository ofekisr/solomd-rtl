export interface OverlayStrings {
  close: string;
  zoomIn: string;
  zoomOut: string;
  resetZoom: string;
  image: string;
  diagram: string;
}

export interface OverlayAction {
  /** Button label (already localised by the caller). */
  label: string;
  onClick: () => void | Promise<void>;
}

export interface OverlayOptions {
  /** An <img> or SVG element to display in the overlay. */
  source: HTMLImageElement | SVGElement;
  /** Optional title (alt text, file name, etc.). */
  title?: string;
  /** Localised UI strings. */
  strings: OverlayStrings;
  /** Extra footer buttons (e.g. "Export PNG" for Mermaid diagrams, #162). */
  actions?: OverlayAction[];
}

export interface OverlayDom {
  backdrop: HTMLDivElement;
  closeBtn: HTMLButtonElement;
  contentEl: HTMLDivElement;
  viewport: HTMLDivElement;
  zoomPct: HTMLSpanElement;
  zoomInBtn: HTMLButtonElement;
  zoomOutBtn: HTMLButtonElement;
  resetBtn: HTMLButtonElement;
  actionBtns: Array<[HTMLButtonElement, OverlayAction]>;
}

export function buildOverlayDom(opts: OverlayOptions): OverlayDom {
  const { source, title, strings } = opts;
  // Determine display title
  let displayTitle = title;
  if (!displayTitle) {
    if (source instanceof HTMLImageElement) {
      displayTitle = source.alt || strings.image;
    } else {
      displayTitle = strings.diagram;
    }
  }

  // ── Build DOM ──

  const backdrop = document.createElement('div');
  backdrop.className = 'io-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-label', displayTitle);

  // Header
  const header = document.createElement('div');
  header.className = 'io-header';
  const titleEl = document.createElement('span');
  titleEl.className = 'io-header-title';
  titleEl.textContent = displayTitle;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'io-close';
  closeBtn.setAttribute('aria-label', strings.close);
  closeBtn.textContent = '\u00d7'; // ×
  header.appendChild(titleEl);
  header.appendChild(closeBtn);

  // Content area
  const contentEl = document.createElement('div');
  contentEl.className = 'io-content';

  const viewport = document.createElement('div');
  viewport.className = 'io-viewport';

  // Clone source
  const clone = source.cloneNode(true) as HTMLElement;
  const isSvg = source instanceof SVGElement;
  if (clone instanceof HTMLImageElement) {
    clone.draggable = false;
  }
  if (isSvg) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
      || document.documentElement.classList.contains('dark');
    viewport.classList.add(isDark ? 'io-viewport--svg-dark' : 'io-viewport--svg');
  }
  viewport.appendChild(clone);
  contentEl.appendChild(viewport);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'io-footer';

  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.setAttribute('aria-label', strings.zoomOut);
  zoomOutBtn.textContent = '\u2212'; // −

  const zoomPct = document.createElement('span');
  zoomPct.className = 'io-zoom-pct';
  zoomPct.textContent = '100%';

  const zoomInBtn = document.createElement('button');
  zoomInBtn.setAttribute('aria-label', strings.zoomIn);
  zoomInBtn.textContent = '+';

  const resetBtn = document.createElement('button');
  resetBtn.setAttribute('aria-label', strings.resetZoom);
  resetBtn.textContent = strings.resetZoom;

  footer.appendChild(zoomOutBtn);
  footer.appendChild(zoomPct);
  footer.appendChild(zoomInBtn);
  footer.appendChild(resetBtn);

  const actionBtns: Array<[HTMLButtonElement, OverlayAction]> = [];
  for (const action of opts.actions ?? []) {
    const btn = document.createElement('button');
    btn.textContent = action.label;
    footer.appendChild(btn);
    actionBtns.push([btn, action]);
  }

  backdrop.appendChild(header);
  backdrop.appendChild(contentEl);
  backdrop.appendChild(footer);

  return {
    backdrop, closeBtn, contentEl, viewport, zoomPct,
    zoomInBtn, zoomOutBtn, resetBtn, actionBtns,
  };
}
