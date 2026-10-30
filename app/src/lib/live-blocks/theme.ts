import { EditorView } from '@codemirror/view';

/** Suggested CSS — pulled out so the editor's theme owns the rule set. */
export const liveBlocksTheme = EditorView.theme({
  // #155 — block widgets must NOT carry vertical margins: CodeMirror measures
  // widget height via the border box, so margin space is invisible to its
  // height map. The resulting drift between the height map and the real DOM
  // below a table/image/math widget made ↑/↓ teleport across whole screens
  // (moveVertically scans with height-map coordinates). Spacing lives in
  // padding instead, which IS measured.
  '.cm-live-block': {
    margin: '0',
    padding: '0.6em 0',
    cursor: 'text',
  },
  '.cm-live-block--image img': {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '6px',
    display: 'block',
  },
  '.cm-live-block--html': {
    maxWidth: '100%',
    overflowX: 'auto',
  },
  '.cm-live-block--html img': {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '6px',
  },
  '.cm-live-block--html table': {
    borderCollapse: 'collapse',
  },
  '.cm-live-block--html th, .cm-live-block--html td': {
    border: '1px solid var(--border)',
    padding: '6px 12px',
  },
  '.cm-live-block--broken': {
    color: 'var(--text-faint)',
    fontStyle: 'italic',
  },
  '.cm-live-block--code pre': {
    margin: '2px 0',
    padding: '6px 12px',
    background: 'var(--code-bg, var(--bg-elev))',
    borderRadius: '6px',
    overflowX: 'auto',
    fontFamily: 'var(--font-mono, ui-monospace, monospace)',
    fontSize: '0.9em',
  },
  '.cm-live-block--table table': {
    borderCollapse: 'collapse',
    margin: '0.4em 0',
    fontSize: '0.95em',
  },
  '.cm-live-block--table th, .cm-live-block--table td': {
    border: '1px solid var(--border)',
    padding: '6px 12px',
    textAlign: 'left',
  },
  '.cm-live-block--table thead th': {
    background: 'var(--bg-soft)',
    fontWeight: '600',
  },
  // v4.3.0 issue #57a — paddings fold in the 0.6em that used to come from the
  // shared margin (see #155 note above) so the visual rhythm is unchanged.
  '.cm-live-block--math': {
    padding: '1em 0',
    overflowX: 'auto',
    textAlign: 'center',
  },
  '.cm-live-block--mermaid': {
    padding: '1.2em 0',
    textAlign: 'center',
  },
  '.cm-live-block--mermaid svg': {
    maxWidth: '100%',
    height: 'auto',
  },
  '.cm-live-block--graphviz': {
    padding: '1.2em 0',
    textAlign: 'center',
  },
  '.cm-live-block--graphviz svg': {
    maxWidth: '100%',
    height: 'auto',
  },
  // v4.10 #163
  '.cm-live-block--plantuml': {
    padding: '1.2em 0',
    textAlign: 'center',
  },
  '.cm-live-block--plantuml img': {
    maxWidth: '100%',
    height: 'auto',
  },
  // mindmap fence widget
  '.cm-live-block--mindmap': { position: 'relative', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' },
  '.cm-mindmap-open': { position: 'absolute', insetBlockStart: '8px', insetInlineEnd: '8px', zIndex: '2' },
  '.cm-live-block--mindmap me-tpc': { unicodeBidi: 'plaintext', textAlign: 'start' },
  // v4.6 F7 — tldraw whiteboard card. A bordered surface hosting the live
  // canvas; the inner `.cm-tldraw-surface` fills it so tldraw can measure.
  // The bordered card is an inner element (`.cm-tldraw-card`) so the outer
  // block can keep its measurable padding (#155) without the border growing
  // around it.
  '.cm-live-block--tldraw': {
    width: '100%',
  },
  '.cm-tldraw-card': {
    position: 'relative',
    width: '100%',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  '.cm-tldraw-surface': {
    position: 'absolute',
    inset: '0',
  },
  '.cm-tldraw-loading': {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    height: '100%',
    color: 'var(--text-faint)',
    fontStyle: 'italic',
    fontSize: '13px',
  },
  '.cm-tldraw-spinner': {
    width: '14px',
    height: '14px',
    border: '2px solid var(--border)',
    borderTopColor: 'var(--accent, var(--text-faint))',
    borderRadius: '50%',
    animation: 'cm-tldraw-spin 0.7s linear infinite',
    flex: '0 0 auto',
  },
  '@keyframes cm-tldraw-spin': {
    to: { transform: 'rotate(360deg)' },
  },
  '.cm-tldraw-toolbar': {
    position: 'absolute',
    top: '6px',
    right: '6px',
    zIndex: '5',
    display: 'flex',
    gap: '4px',
  },
  '.cm-tldraw-fullscreen': {
    appearance: 'none',
    border: '1px solid var(--border)',
    background: 'var(--bg)',
    color: 'var(--text)',
    borderRadius: '6px',
    width: '26px',
    height: '26px',
    lineHeight: '1',
    cursor: 'pointer',
    fontSize: '14px',
    opacity: '0.85',
  },
  '.cm-tldraw-fullscreen:hover': {
    opacity: '1',
  },
});
