import { EditorView } from '@codemirror/view';

export const slashTheme = EditorView.theme({
  '.cm-slash-popup': {
    width: '280px',
    maxHeight: '320px',
    overflowY: 'auto',
    background: 'var(--bg-elevated, var(--bg, #fff))',
    border: '1px solid var(--border, rgba(0, 0, 0, 0.12))',
    borderRadius: '6px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
    padding: '4px',
    fontSize: '13px',
    fontFamily: 'inherit',
    color: 'var(--text, #222)',
    userSelect: 'none',
  },
  '.cm-slash-row': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    lineHeight: '1.3',
  },
  '.cm-slash-row--active': {
    background: 'var(--bg-hover, rgba(255, 159, 64, 0.18))',
  },
  '.cm-slash-icon': {
    display: 'inline-flex',
    width: '22px',
    height: '22px',
    minWidth: '22px',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-soft, rgba(0, 0, 0, 0.04))',
    color: 'var(--text-muted, #666)',
    borderRadius: '4px',
    fontFamily: 'var(--font-mono, "JetBrains Mono", Menlo, monospace)',
    fontSize: '11px',
    fontWeight: '600',
  },
  '.cm-slash-label': {
    flex: '1 1 auto',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  '.cm-slash-hint': {
    flex: '0 0 auto',
    color: 'var(--text-faint, #999)',
    fontSize: '11px',
    fontFamily: 'var(--font-mono, "JetBrains Mono", Menlo, monospace)',
  },
  '.cm-slash-empty': {
    padding: '8px 10px',
    color: 'var(--text-faint, #999)',
    fontSize: '12px',
    lineHeight: '1.4',
  },
  // The CM6 tooltip wrapper itself — strip its default chrome so our
  // own panel styling shows through.
  '.cm-tooltip.cm-tooltip-below.cm-slash-tooltip': {
    background: 'transparent',
    border: 'none',
    padding: 0,
    boxShadow: 'none',
  },
});
