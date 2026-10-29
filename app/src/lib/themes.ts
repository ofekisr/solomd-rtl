import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import type { Extension } from '@codemirror/state';
import type { ThemeMode } from './theme/schema.ts';

const font = (token: string): { fontStyle: string; fontWeight: string; textDecoration: string } => ({
  fontStyle: `var(--syn-${token}-style)`,
  fontWeight: `var(--syn-${token}-weight)`,
  textDecoration: `var(--syn-${token}-decoration)`,
});

export const unifiedHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: 'var(--syn-keyword)', ...font('keyword') },
  { tag: [t.name, t.deleted, t.character, t.macroName], color: 'var(--syn-variable)' },
  { tag: [t.function(t.variableName), t.labelName], color: 'var(--syn-function)', ...font('function') },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: 'var(--syn-constant)' },
  { tag: [t.definition(t.name), t.separator], color: 'var(--text)' },
  { tag: [t.typeName, t.className, t.changed, t.annotation, t.modifier, t.self, t.namespace], color: 'var(--syn-type)' },
  { tag: [t.number, t.bool], color: 'var(--syn-number)' },
  { tag: [t.string, t.special(t.brace)], color: 'var(--syn-string)', ...font('string') },
  { tag: t.regexp, color: 'var(--syn-regexp)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--syn-comment)', ...font('comment') },
  { tag: [t.meta, t.processingInstruction], color: 'var(--syn-comment)' },
  { tag: t.link, color: 'var(--md-link)', textDecoration: 'var(--md-link-decoration)' },
  { tag: t.heading, color: 'var(--md-h1)', fontWeight: 'var(--md-heading-weight)', fontStyle: 'var(--md-heading-style)' },
  { tag: [t.atom, t.special(t.variableName)], color: 'var(--syn-function)' },
  { tag: t.tagName, color: 'var(--syn-tag)' },
  { tag: t.attributeName, color: 'var(--syn-attribute)' },
  { tag: t.invalid, color: 'var(--syn-invalid)' },
  { tag: t.strikethrough, textDecoration: 'line-through' },
  { tag: t.propertyName, color: 'var(--syn-property)' },
  { tag: t.operator, color: 'var(--syn-operator)' },
  { tag: t.punctuation, color: 'var(--syn-punctuation)' },
]);

function chrome(dark: boolean): Extension {
  return EditorView.theme(
    {
      '&': { backgroundColor: 'var(--cm-bg)', color: 'var(--text)' },
      '.cm-content': { caretColor: 'var(--cm-cursor)' },
      '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--cm-cursor)' },
      '.cm-selectionBackground, ::selection': { backgroundColor: 'var(--cm-selection) !important' },
      '.cm-gutters': { backgroundColor: 'var(--cm-gutter-bg)', color: 'var(--cm-gutter-fg)', border: 'none' },
      '.cm-activeLine': { backgroundColor: 'var(--cm-active-line)' },
      '.cm-activeLineGutter': { color: 'var(--cm-cursor)', backgroundColor: 'var(--cm-active-line)' },
      '.cm-matchingBracket': { backgroundColor: 'var(--cm-bracket)' },
      '.cm-searchMatch': { backgroundColor: 'var(--cm-search)' },
      '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: 'var(--cm-search-active)' },
    },
    { dark },
  );
}

const CHROME: Record<ThemeMode, Extension> = { light: chrome(false), dark: chrome(true) };

/** Every theme paints through CSS variables, so only the light/dark flip reconfigures the editor. */
export function cmThemeFor(mode: ThemeMode): Extension {
  return [CHROME[mode], syntaxHighlighting(unifiedHighlightStyle)];
}
