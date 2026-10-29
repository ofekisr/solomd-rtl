// app/scripts/theme/catalog-page.ts
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, drawSelection, highlightActiveLine, lineNumbers } from '@codemirror/view';
import { highlightingFor } from '@codemirror/language';
import { tags as t, type Tag } from '@lezer/highlight';
import { oneDark } from '@codemirror/theme-one-dark';
import * as uiw from '@uiw/codemirror-themes-all';

const TAGS: Record<string, Tag> = {
  keyword: t.keyword, string: t.string, number: t.number, comment: t.comment, function: t.function(t.variableName),
  variable: t.variableName, type: t.typeName, property: t.propertyName, operator: t.operator, punctuation: t.punctuation,
  tag: t.tagName, attribute: t.attributeName, regexp: t.regexp, constant: t.constant(t.name), invalid: t.invalid,
  heading: t.heading, link: t.link, emphasis: t.emphasis, strong: t.strong, quote: t.quote,
};
const BOLD_WEIGHT_MIN = 600;
const NOT_A_THEME_RE = /(Init|Style|Settings|settings|Theme)$|^default/;

function themeExports(): [string, Extension][] {
  const entries = Object.entries(uiw).filter(([name, v]) => !NOT_A_THEME_RE.test(name) && typeof v === 'object' && v !== null);
  return [['oneDark', oneDark], ...(entries as [string, Extension][])];
}

function probe(cls: string, parent: Element): CSSStyleDeclaration {
  const el = document.createElement('span');
  el.className = cls;
  el.textContent = 'x';
  parent.appendChild(el);
  return getComputedStyle(el);
}

function readTags(view: EditorView) {
  const line = view.contentDOM.querySelector('.cm-line') as Element;
  return Object.fromEntries(Object.entries(TAGS).map(([key, tag]) => {
    const s = probe(highlightingFor(view.state, [tag]) ?? '', line);
    return [key, { color: s.color, italic: s.fontStyle === 'italic', bold: Number(s.fontWeight) >= BOLD_WEIGHT_MIN || s.fontWeight === 'bold' }];
  }));
}

function bg(el: Element | null): string {
  return el ? getComputedStyle(el).backgroundColor : '';
}

function fg(el: Element | null): string {
  return el ? getComputedStyle(el).color : '';
}

function cursorColor(root: Element): string {
  const el = root.querySelector('.cm-cursor');
  return el ? getComputedStyle(el).borderLeftColor : '';
}

function readChrome(view: EditorView) {
  const root = view.dom;
  const line = view.contentDOM.querySelector('.cm-line') as Element;
  const gutters = root.querySelector('.cm-gutters');
  return {
    background: bg(root), foreground: fg(root),
    gutterBg: bg(gutters), gutterFg: fg(gutters),
    activeLine: bg(root.querySelector('.cm-activeLine')),
    selection: bg(root.querySelector('.cm-selectionBackground')),
    cursor: cursorColor(root),
    bracket: probe('cm-matchingBracket', line).backgroundColor,
    search: probe('cm-searchMatch', line).backgroundColor,
    searchActive: probe('cm-searchMatch cm-searchMatch-selected', line).backgroundColor,
  };
}

const FRAME_COUNT = 2;

async function settle(): Promise<void> {
  for (let i = 0; i < FRAME_COUNT; i += 1) await new Promise((r) => requestAnimationFrame(r));
}

async function extract(name: string, theme: Extension) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const state = EditorState.create({ doc: 'const x = 1;\nlet y = 2;', selection: { anchor: 0, head: 5 },
    extensions: [theme, lineNumbers(), drawSelection(), highlightActiveLine()] });
  const view = new EditorView({ state, parent: host });
  view.focus();
  await settle();
  const out = { id: `cm-${name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, name, chrome: readChrome(view), tags: readTags(view) };
  view.destroy();
  host.remove();
  return out;
}

async function extractAll(): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const [n, th] of themeExports()) {
    try { out.push(await extract(n, th)); } catch (e) { console.warn(`extract ${n}: ${String(e)}`); }
  }
  return out;
}

(window as unknown as { extractAll: () => Promise<unknown[]> }).extractAll = extractAll;
