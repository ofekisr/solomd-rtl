import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import type StateCore from 'markdown-it/lib/rules_core/state_core.mjs';
import { getFrontMatterRaw, setFrontMatterRaw } from './front-matter.ts';
import { slugify } from './text.ts';

// ---- Document table of contents (`[TOC]`) ---------------------------------
// Expand a standalone, case-insensitive `[TOC]` paragraph at token level. Doing
// this after markdown-it-anchor has assigned heading ids keeps the links and
// duplicate-heading suffixes identical to the rendered headings. It also keeps
// the original source line map intact; expanding the source text itself would
// shift every heading after a large TOC and break split-pane scroll sync.
const TOC_MARKER_RE = /^\[toc\]$/i;

interface TocHeading {
  level: number;
  text: string;
  id: string;
}

function tocHeadingText(inline: Token | undefined): string {
  const children = inline?.children ?? [];
  let text = '';
  for (const child of children) {
    if (child.type === 'softbreak' || child.type === 'hardbreak') {
      text += ' ';
    } else if (child.type === 'html_inline') {
      text += String(child.content || '').replace(/<[^>]*>/g, '');
    } else if (
      child.type === 'text' ||
      child.type === 'code_inline' ||
      child.type === 'math_inline' ||
      child.type === 'image' ||
      child.type === 'footnote_ref'
    ) {
      text += child.content || '';
    }
  }
  return text.replace(/\s+/g, ' ').trim();
}

function tocHeadingsFromTokens(tokens: Token[]): TocHeading[] {
  const headings: TocHeading[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const open = tokens[i];
    const inline = tokens[i + 1];
    if (open.type !== 'heading_open' || inline?.type !== 'inline') continue;
    const level = Number.parseInt(String(open.tag || '').slice(1), 10);
    if (!Number.isFinite(level) || level < 1 || level > 6) continue;
    const text = tocHeadingText(inline) || inline.content.trim();
    const id = open.attrGet('id') || slugify(inline.content);
    if (text && id) headings.push({ level, text, id });
  }
  return headings;
}

function escapeTocLinkLabel(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function tocListMarkdown(headings: TocHeading[]): string {
  const levelStack: number[] = [];
  const lines: string[] = [];
  for (const heading of headings) {
    while (levelStack.length && levelStack[levelStack.length - 1] >= heading.level) {
      levelStack.pop();
    }
    const depth = levelStack.length;
    levelStack.push(heading.level);
    lines.push(
      `${'  '.repeat(depth)}- [${escapeTocLinkLabel(heading.text)}](#${heading.id})`,
    );
  }
  return lines.join('\n');
}

function parseForToc(state: StateCore, source: string): Token[] {
  // The front-matter plugin writes through a module-level capture used by the
  // outer render. A nested parse for a live-edit fragment must not replace that
  // capture with the full document's front matter.
  const savedFrontMatter = getFrontMatterRaw();
  try {
    return state.md.parse(source, { solomdTocScan: true });
  } finally {
    setFrontMatterRaw(savedFrontMatter);
  }
}

function tocListTokens(state: StateCore, headings: TocHeading[]): Token[] {
  const tokens = parseForToc(state, tocListMarkdown(headings));
  for (const token of tokens) {
    // These maps describe the generated list, not the user's document. Leaving
    // them attached would create bogus data-source-line values in the preview.
    token.map = null;
    const sourceLineAttr = token.attrIndex('data-source-line');
    if (sourceLineAttr >= 0) token.attrs?.splice(sourceLineAttr, 1);
    if (token.type === 'bullet_list_open') token.attrJoin('class', 'md-toc__list');
    if (token.type === 'list_item_open') token.attrJoin('class', 'md-toc__item');
    // Inline children are not present in the top-level token array; decorate
    // their link_open tokens explicitly so TOC links can be styled in every
    // renderer that consumes the shared markdown-it instance.
    for (const child of token.children ?? []) {
      if (child.type === 'link_open') child.attrJoin('class', 'md-toc__link');
    }
  }
  return tokens;
}

export function installTableOfContents(md: MarkdownIt): void {
  md.core.ruler.before('source_line_map', 'table_of_contents', (state) => {
    const env = (state.env || {}) as Record<string, unknown>;
    if (env.solomdTocScan === true) return;

    const sourceLines = state.src.split('\n');
    const markers: number[] = [];
    for (let i = 0; i < state.tokens.length - 2; i++) {
      const open = state.tokens[i];
      const inline = state.tokens[i + 1];
      const close = state.tokens[i + 2];
      if (
        open.type !== 'paragraph_open' ||
        inline?.type !== 'inline' ||
        close?.type !== 'paragraph_close' ||
        !TOC_MARKER_RE.test(inline.content.trim()) ||
        !open.map ||
        open.map[1] !== open.map[0] + 1 ||
        !/^[ \t]*\[toc\][ \t]*\r?$/i.test(sourceLines[open.map[0]] ?? '')
      ) {
        continue;
      }
      markers.push(i);
    }
    if (!markers.length) return;

    const externalSource = env.solomdTocSource;
    const headingTokens =
      typeof externalSource === 'string' ? parseForToc(state, externalSource) : state.tokens;
    const headings = tocHeadingsFromTokens(headingTokens);

    // Work backwards so splicing one marker never invalidates a later index.
    for (let m = markers.length - 1; m >= 0; m--) {
      const markerIndex = markers[m];
      const marker = state.tokens[markerIndex];
      if (!headings.length) {
        state.tokens.splice(markerIndex, 3);
        continue;
      }
      const navOpen = new state.Token('toc_open', 'nav', 1);
      navOpen.block = true;
      navOpen.map = marker.map;
      navOpen.attrSet('class', 'md-toc');
      navOpen.attrSet('aria-label', 'Table of contents');
      navOpen.attrSet('data-source-line', String((marker.map?.[0] ?? 0) + 1));
      const navClose = new state.Token('toc_close', 'nav', -1);
      navClose.block = true;
      state.tokens.splice(
        markerIndex,
        3,
        navOpen,
        ...tocListTokens(state, headings),
        navClose,
      );
    }
  });
}
