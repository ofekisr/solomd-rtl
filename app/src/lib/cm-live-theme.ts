import { HighlightStyle } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

// Rich syntax highlighting — same palette as cm-live-preview.ts but kept
// here so live-edit can be used independently of the live-preview toggle.
export const liveEditHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontWeight: '700', color: 'var(--md-h1)' },
  { tag: t.heading2, fontWeight: '700', color: 'var(--md-h2)' },
  { tag: t.heading3, fontWeight: '700', color: 'var(--md-h3)' },
  { tag: t.heading4, fontWeight: '700', color: 'var(--md-h4)' },
  { tag: t.heading5, fontWeight: '700', color: 'var(--md-h5)' },
  { tag: t.heading6, fontWeight: '700', color: 'var(--md-h6)' },
  { tag: t.strong, fontWeight: '700', color: 'var(--md-strong)' },
  { tag: t.emphasis, fontStyle: 'italic', color: 'var(--md-em)' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  { tag: t.link, color: 'var(--md-link)' },
  { tag: t.url, color: 'var(--md-url)' },
  { tag: t.monospace, fontFamily: 'var(--font-mono)', color: 'var(--md-code)' },
  { tag: t.quote, color: 'var(--md-quote)', fontStyle: 'italic' },
  { tag: t.list, color: 'var(--md-list)' },
  { tag: t.contentSeparator, color: 'var(--md-hr)' },
  { tag: t.processingInstruction, color: 'var(--text-faint)' },
  // Code-block syntax (nested languages)
  { tag: t.keyword, color: 'var(--syn-keyword)' },
  { tag: t.string, color: 'var(--syn-string)' },
  { tag: t.number, color: 'var(--syn-number)' },
  { tag: t.comment, color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: t.function(t.variableName), color: 'var(--syn-function)' },
  { tag: t.variableName, color: 'var(--syn-variable)' },
  { tag: t.typeName, color: 'var(--syn-type)' },
  { tag: t.className, color: 'var(--syn-type)' },
  { tag: t.propertyName, color: 'var(--syn-property)' },
  { tag: t.operator, color: 'var(--syn-operator)' },
  { tag: t.punctuation, color: 'var(--text-muted)' },
  { tag: t.bracket, color: 'var(--text-muted)' },
  { tag: t.bool, color: 'var(--syn-number)' },
  { tag: t.null, color: 'var(--syn-number)' },
  { tag: t.tagName, color: 'var(--syn-keyword)' },
  { tag: t.attributeName, color: 'var(--syn-property)' },
  { tag: t.attributeValue, color: 'var(--syn-string)' },
]);

// Theme: heading sizes match the Preview pane sizes (h1 2em, h2 1.5em,
// h3 1.2em) so toggling between liveEdit and preview feels seamless.
export const liveEditTheme = EditorView.theme({
  '.cm-line': {
    fontVariantLigatures: 'none',
  },
  // #353 — markers left visible by "Always show Markdown markers": keep the
  // line's size/weight (so nothing reflows) but mute the colour.
  '.cm-md-marker': {
    color: 'var(--text-faint)',
    fontWeight: 'normal',
    fontStyle: 'normal',
  },
  // Heading lines — use line-decoration to size whole line so layout
  // doesn't jump when markers are revealed/hidden.
  // Note: do NOT set a custom lineHeight here. Heading visual height is
  // achieved through fontSize + padding alone. Overriding lineHeight per
  // line breaks CodeMirror's posAtCoords math (it caches line-box metrics
  // measured against the base lineHeight), making click-to-position land
  // on the wrong line. Keep line-height uniform at the .cm-scroller base.
  '.cm-md-heading-line-1': {
    fontSize: '1.85em',
    fontWeight: '700',
    paddingTop: '0.4em',
    paddingBottom: '0.15em',
  },
  '.cm-md-heading-line-2': {
    fontSize: '1.5em',
    fontWeight: '700',
    paddingTop: '0.3em',
    paddingBottom: '0.1em',
  },
  '.cm-md-heading-line-3': {
    fontSize: '1.22em',
    fontWeight: '700',
  },
  '.cm-md-heading-line-4': { fontSize: '1.1em', fontWeight: '700' },
  '.cm-md-heading-line-5': { fontWeight: '700' },
  '.cm-md-heading-line-6': { fontWeight: '700', color: 'var(--text-muted)' },

  // Heading text color (from the heading mark). The line decoration sets
  // size; this paints the color so emphasis/strong inside a heading
  // inherit cleanly.
  '.cm-md-h1': { color: 'var(--md-h1)' },
  '.cm-md-h2': { color: 'var(--md-h2)' },
  '.cm-md-h3': { color: 'var(--md-h3)' },
  '.cm-md-h4': { color: 'var(--md-h4)' },
  '.cm-md-h5': { color: 'var(--md-h5)' },
  '.cm-md-h6': { color: 'var(--md-h6)' },

  '.cm-md-strong': { fontWeight: '700', color: 'var(--md-strong)' },
  '.cm-md-em': { fontStyle: 'italic', color: 'var(--md-em)' },
  '.cm-md-strike': { textDecoration: 'line-through', color: 'var(--text-muted)' },
  '.cm-md-html-u': { textDecoration: 'underline' },
  '.cm-md-html-mark': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 24%, transparent)',
    borderRadius: '2px',
  },
  '.cm-md-html-sub': { fontSize: '0.75em', verticalAlign: 'sub' },
  '.cm-md-html-sup': { fontSize: '0.75em', verticalAlign: 'super' },
  '.cm-md-html-kbd': {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.82em',
    backgroundColor: 'var(--md-code-bg)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '0.05em 0.3em',
  },

  '.cm-md-code': {
    fontFamily: 'var(--font-mono)',
    wordSpacing: '-0.25em',
    color: 'var(--md-code)',
    backgroundColor: 'var(--md-code-bg)',
    padding: '0.1em 0.35em',
    borderRadius: '4px',
  },

  '.cm-md-code--revealed': {
    paddingLeft: '0.1em',
    paddingRight: '0.1em',
  },
  '.cm-md-code-tick': {
    display: 'inline-block',
    width: '0.4em',
    textAlign: 'center',
  },

  '.cm-md-link': {
    color: 'var(--md-link)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
  },

  // v4.7.1 — bullet glyph that replaces a `-`/`*`/`+` list marker off-line.
  '.cm-md-bullet': {
    color: 'var(--md-list)',
    fontWeight: '700',
  },

  // v4.7.1 — `---` / `***` / `___` rendered as a real rule off-line. The
  // widget replaces the whole marker run, so make it span the text column.
  '.cm-md-hr': {
    display: 'inline-block',
    width: '100%',
    height: '0',
    margin: '0.2em 0',
    border: 'none',
    borderTop: '1px solid var(--border)',
    verticalAlign: 'middle',
  },

  '.cm-md-quote-line': {
    borderLeft: '3px solid var(--border)',
    paddingLeft: '12px',
    color: 'var(--md-quote)',
    fontStyle: 'italic',
    backgroundColor: 'var(--bg-elev, transparent)',
  },

  // One bordered box per block: every line carries the side borders, the
  // first/last lines close it at the top/bottom.
  '.cm-md-fenced-line': {
    backgroundColor: 'var(--md-code-bg)',
    fontFamily: 'var(--font-mono)',
    // Containing block for the copy button that rides the block's first line.
    position: 'relative',
    borderLeft: '1px solid var(--md-code-border, var(--border))',
    borderRight: '1px solid var(--md-code-border, var(--border))',
  },
  '.cm-md-fenced-first, .cm-md-fenced-only': {
    borderTop: '1px solid var(--md-code-border, var(--border))',
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
  },
  '.cm-md-fenced-last, .cm-md-fenced-only': {
    borderBottom: '1px solid var(--md-code-border, var(--border))',
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
  },
  '.cm-md-fenced-line.cm-md-fenced-active': {
    borderLeftColor: 'var(--accent)',
    borderRightColor: 'var(--accent)',
  },
  '.cm-md-fenced-first.cm-md-fenced-active, .cm-md-fenced-only.cm-md-fenced-active': {
    borderTopColor: 'var(--accent)',
  },
  '.cm-md-fenced-last.cm-md-fenced-active, .cm-md-fenced-only.cm-md-fenced-active': {
    borderBottomColor: 'var(--accent)',
  },
  // The whole block is the active unit; a per-line highlight would split it.
  '.cm-md-fenced-line.cm-activeLine': {
    backgroundColor: 'var(--md-code-bg)',
  },
  '.cm-md-fenced-line .cm-md-marker': {
    color: 'var(--text-muted)',
  },
  '.cm-md-fence-lang': {
    fontSize: '0.8em',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '0 6px',
  },

  // Code-block mode toggle (edit/split/preview)
  '.cm-md-code-mode-toggle': {
    position: 'absolute',
    zIndex: '4',
    top: '1px',
    right: '54px',
    display: 'flex',
    gap: '2px',
    padding: '0',
    margin: '0',
    lineHeight: '1',
  },
  '.cm-md-code-mode-btn': {
    minWidth: '28px',
    height: '20px',
    padding: '0 6px',
    border: '1px solid var(--border)',
    borderRadius: '3px',
    background: 'color-mix(in srgb, var(--bg) 85%, transparent)',
    color: 'var(--text-muted)',
    font: '10px/18px var(--font-ui)',
    cursor: 'pointer',
    opacity: '0.45',
    userSelect: 'none',
    transition: 'opacity 0.15s, color 0.15s, border-color 0.15s, background-color 0.15s',
  },
  '.cm-md-code-mode-btn:hover': {
    opacity: '0.7',
    color: 'var(--text)',
  },
  '.cm-md-code-mode-btn.cm-md-code-mode-active': {
    opacity: '1',
    color: 'var(--accent)',
    borderColor: 'var(--accent)',
    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
  },

  // v4.11.18 — code-block copy button. Same visual language as the preview
  // pane's `.code-copy-button` (styles/main.css), sized down a notch so it
  // fits inside a single editor line.
  '.cm-md-code-copy': {
    position: 'absolute',
    zIndex: '3',
    top: '1px',
    right: '8px',
    minWidth: '42px',
    height: '20px',
    padding: '0 8px',
    border: '1px solid var(--border)',
    borderRadius: '5px',
    background: 'color-mix(in srgb, var(--bg) 88%, transparent)',
    color: 'var(--text-muted)',
    font: '11px/18px var(--font-ui)',
    cursor: 'pointer',
    opacity: '0.55',
    userSelect: 'none',
    transition: 'opacity 0.15s, color 0.15s, border-color 0.15s',
  },
  '.cm-md-code-copy:hover, .cm-md-code-copy:focus-visible': {
    opacity: '1',
    color: 'var(--accent)',
    borderColor: 'var(--accent)',
    outline: 'none',
  },

  // #82 / #44 — selection highlight inside code was invisible in live-edit.
  // Inline `.cm-md-code` and `.cm-md-fenced-line` paint an opaque
  // `--md-code-bg`, and CM6's `layer` extension writes inline
  // `style="z-index: -2"` on `.cm-selectionLayer`, parking the selection
  // BENEATH those backgrounds. `!important` beats the inline style so the
  // selection layer sits above the code bg; 45% alpha keeps the code text
  // readable through the highlight. (The same fix already lives in
  // cm-live-preview.ts — the earlier patches only covered that mode, not
  // this one, which is the WYSIWYG "live edit" the reporters actually use.)
  '.cm-selectionLayer': { zIndex: '2 !important' },
  '.cm-selectionBackground': {
    backgroundColor: 'rgba(255,159,64,0.45) !important',
  },
});
