import { Decoration } from '@codemirror/view';
import type { LiveInlineHtmlKind } from './html-live-render.ts';

export const HIDDEN_MARK_NODES = new Set<string>([
  'HeaderMark',     // `#`, `##`, …
  'EmphasisMark',   // `*`, `_`
  'StrikethroughMark', // `~~`
  'CodeMark',       // backticks for inline code AND fenced code
  'LinkMark',       // `[`, `]`, `(`, `)` around links
  'QuoteMark',      // `>` at start of blockquote lines
  'LinkTitle',      // optional title in `[label](url "title")`
  'CodeInfo',       // language tag after ``` — visually noisy off-line
]);

// `URL` nodes are special: inside `[label](url)` we want to hide them so
// only the label shows; inside an Autolink (`<https://x.com>`) the URL
// IS the visible text and hiding it would erase the link. We handle URL
// in the iterate callback by checking the parent.

// Inline mark decorations applied on top of the existing token highlight.
// Class names follow `cm-md-…` so theme overrides are easy.
export const headingClass = (level: number) =>
  Decoration.mark({ class: `cm-md-h cm-md-h${level}`, inclusive: false });
export const strongMark = Decoration.mark({ class: 'cm-md-strong' });
export const emMark = Decoration.mark({ class: 'cm-md-em' });
export const strikeMark = Decoration.mark({ class: 'cm-md-strike' });
export const codeMark = Decoration.mark({ class: 'cm-md-code' });
export const codeRevealedMark = Decoration.mark({ class: 'cm-md-code cm-md-code--revealed' });
export const codeTickMark = Decoration.mark({ class: 'cm-md-code-tick' });
export const linkMark = Decoration.mark({ class: 'cm-md-link' });
export const htmlUnderlineMark = Decoration.mark({ class: 'cm-md-html-u' });
export const htmlMarkMark = Decoration.mark({ class: 'cm-md-html-mark' });
export const htmlSubMark = Decoration.mark({ class: 'cm-md-html-sub' });
export const htmlSupMark = Decoration.mark({ class: 'cm-md-html-sup' });
export const htmlKbdMark = Decoration.mark({ class: 'cm-md-html-kbd' });

export function inlineHtmlMark(kind: LiveInlineHtmlKind): Decoration {
  switch (kind) {
    case 'strong': return strongMark;
    case 'em': return emMark;
    case 'underline': return htmlUnderlineMark;
    case 'strike': return strikeMark;
    case 'mark': return htmlMarkMark;
    case 'sub': return htmlSubMark;
    case 'sup': return htmlSupMark;
    case 'code': return codeMark;
    case 'kbd': return htmlKbdMark;
  }
}

export function fencedPosition(line: number, first: number, last: number): 'first' | 'mid' | 'last' | 'only' {
  if (first === last) return 'only';
  if (line === first) return 'first';
  return line === last ? 'last' : 'mid';
}

// Block-level line decorations.
export const lineClass = (cls: string) => Decoration.line({ class: cls });
export const quoteLine = lineClass('cm-md-quote-line');
export const fencedLineCache = new Map<string, Decoration>();
export function fencedLine(position: 'first' | 'mid' | 'last' | 'only', isActive: boolean): Decoration {
  const cls = `cm-md-fenced-line cm-md-fenced-${position}${isActive ? ' cm-md-fenced-active' : ''}`;
  let deco = fencedLineCache.get(cls);
  if (!deco) {
    deco = lineClass(cls);
    fencedLineCache.set(cls, deco);
  }
  return deco;
}
export const fenceLangMark = Decoration.mark({ class: 'cm-md-fence-lang' });
export const headingLine = (level: number) => lineClass(`cm-md-heading-line cm-md-heading-line-${level}`);

export const hideDeco = Decoration.replace({});
// #353 "Always show Markdown markers": the markers stay in the text, dimmed,
// instead of being replaced. Styling (heading size, bold, …) is unchanged.
export const markerMark = Decoration.mark({ class: 'cm-md-marker' });
