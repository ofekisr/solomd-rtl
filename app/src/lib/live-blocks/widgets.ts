import { WidgetType } from '@codemirror/view';
import { installSvgImageFallbacks, rewriteImageUrls } from '../image-resolve.ts';
import { renderMarkdown } from '../markdown.ts';
import katex from 'katex';
import { trackImageHeights } from './layout.ts';
import 'katex/contrib/mhchem';

export class ImageWidget extends WidgetType {
  constructor(
    private readonly src: string,
    private readonly alt: string,
    private readonly localPath: string | null = null,
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt && other.localPath === this.localPath;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-live-block cm-live-block--image';
    const img = document.createElement('img');
    img.src = this.src;
    img.alt = this.alt;
    img.loading = 'lazy';
    img.draggable = false;
    if (this.localPath) img.dataset.solomdLocalSrc = this.localPath;
    img.onerror = () => {
      // Image failed to load — fall back to a small "broken image" caption
      // rather than a giant empty box. The source text is one cursor-move
      // away regardless.
      if (this.localPath) return;
      wrap.classList.add('cm-live-block--broken');
      wrap.textContent = `🖼 ${this.alt || this.src}`;
    };
    wrap.appendChild(img);
    installSvgImageFallbacks(wrap);
    trackImageHeights(wrap);
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export class TableWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly variant: 'table' | 'code' = 'table',
  ) {
    super();
  }

  eq(other: TableWidget): boolean {
    return other.source === this.source && other.variant === this.variant;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = `cm-live-block cm-live-block--${this.variant}`;
    // Render the table source through the same markdown pipeline used by the
    // preview pane so we get GFM alignment, inline formatting, etc. for free.
    // We strip everything except the table rows from the rendered output.
    const html = renderMarkdown(this.source);
    wrap.innerHTML = html;
    trackImageHeights(wrap);
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

/** Raw block HTML rendered with the same markdown-it pipeline as Preview.vue. */
export class HtmlBlockWidget extends WidgetType {
  constructor(
    private readonly source: string,
    private readonly imageRoot: string | null,
    private readonly filePath?: string,
  ) {
    super();
  }

  eq(other: HtmlBlockWidget): boolean {
    return (
      other.source === this.source &&
      other.imageRoot === this.imageRoot &&
      other.filePath === this.filePath
    );
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-live-block cm-live-block--html';
    wrap.innerHTML = rewriteImageUrls(
      renderMarkdown(this.source),
      this.imageRoot,
      this.filePath,
    );
    installSvgImageFallbacks(wrap);
    trackImageHeights(wrap);
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// v4.3.0 issue #57a — block math (`$$...$$`). Goes through markdown-it so
// it picks up the same KaTeX renderer used in the preview pane. We render
// the wrapping `$$\n…\n$$` literal so markdown-it-katex sees it as block
// math and emits `<span class="katex-display">`.
export class MathWidget extends WidgetType {
  constructor(private readonly source: string) {
    super();
  }

  eq(other: MathWidget): boolean {
    return other.source === this.source;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'cm-live-block cm-live-block--math';
    try {
      wrap.innerHTML = renderMarkdown(this.source);
    } catch (e) {
      wrap.classList.add('cm-live-block--broken');
      wrap.textContent = `∑ ${(e as Error).message}`;
    }
    return wrap;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// v4.5.5 — inline math (`$…$`). Standard markdown parsers don't emit
// inline-math nodes, so cm-live-render's syntax-tree pass can't see them.
// We detect spans with inlineMathSpans() below and replace each with a
// KaTeX render while the caret is off the line (click in → source returns).
export class InlineMathWidget extends WidgetType {
  constructor(private readonly tex: string) {
    super();
  }

  eq(other: InlineMathWidget): boolean {
    return other.tex === this.tex;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-live-inline-math';
    try {
      span.innerHTML = katex.renderToString(this.tex, {
        throwOnError: false,
        displayMode: false,
      });
    } catch {
      span.classList.add('cm-live-inline-math--broken');
      span.textContent = `$${this.tex}$`;
    }
    return span;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// Detect inline math `$…$` spans within a single line. Offsets are relative
// to the line start. Guards against the common false positives so prose isn't
// mangled:
//   - `$$` block-math delimiters are skipped (handled as block widgets).
//   - `$` inside inline code spans (`` `…$…` ``) is ignored.
//   - escaped `\$` neither opens nor closes.
//   - currency like `$5` / `$5 and $10`: an opening `$` can't be followed by
//     whitespace, and a closing `$` followed by a digit is rejected.
//   - empty or space-padded content (`$ $`, `$x $`) is rejected.
export function inlineMathSpans(text: string): Array<{ start: number; end: number; tex: string }> {
  const spans: Array<{ start: number; end: number; tex: string }> = [];
  const n = text.length;
  // Mask out inline-code spans (matched backtick runs of equal length).
  const code = new Array<boolean>(n).fill(false);
  for (let p = 0; p < n; ) {
    if (text[p] === '`') {
      let len = 1;
      while (p + len < n && text[p + len] === '`') len++;
      let q = p + len;
      let closed = -1;
      while (q < n) {
        if (text[q] === '`') {
          let len2 = 1;
          while (q + len2 < n && text[q + len2] === '`') len2++;
          if (len2 === len) { closed = q + len2; break; }
          q += len2;
        } else q++;
      }
      if (closed >= 0) { for (let k = p; k < closed; k++) code[k] = true; p = closed; }
      else p += len;
    } else p++;
  }
  let i = 0;
  while (i < n) {
    if (text[i] !== '$' || code[i]) { i++; continue; }
    if (i > 0 && text[i - 1] === '\\') { i++; continue; }          // escaped \$
    if (text[i + 1] === '$') { i += 2; continue; }                  // $$ block delimiter
    if (i + 1 >= n || /\s/.test(text[i + 1])) { i++; continue; }    // opening must hug content
    let j = i + 1;
    let close = -1;
    while (j < n) {
      if (text[j] === '\\') { j += 2; continue; }
      if (text[j] === '$' && !code[j]) { close = j; break; }
      j++;
    }
    if (close < 0) { i++; continue; }
    const content = text.slice(i + 1, close);
    if (!content.trim() || /\s$/.test(content)) { i = close + 1; continue; }   // empty / space-padded
    if (close + 1 < n && /\d/.test(text[close + 1])) { i = close + 1; continue; } // currency $5
    spans.push({ start: i, end: close + 1, tex: content });
    i = close + 1;
  }
  return spans;
}
