import MarkdownIt, { type PluginWithOptions } from 'markdown-it';
import anchor from 'markdown-it-anchor';
import { inlineFencePlugin } from '../inline-fence.ts';
import hljs from '../hljs-languages.ts';
import 'katex/contrib/mhchem';
// @ts-ignore — types are loose
import katex from '@vscode/markdown-it-katex';
// @ts-ignore — no types shipped
import footnote from 'markdown-it-footnote';
// @ts-ignore — no types shipped
import frontMatter from 'markdown-it-front-matter';
// @ts-ignore — no types shipped
import mark from 'markdown-it-mark';
import cjkFriendly from 'markdown-it-cjk-friendly';
import { numberEquations } from '../equations.ts';
import { renderNumberedBlocks } from './block-badges.ts';
import { sanitizeRenderedHtml } from '../sanitize-html.ts';
import { documentDirection } from '../doc-direction.ts';
import { installInlineRules } from './inline-rules.ts';
import { installFenceRules } from './fence.ts';
import { installSourceLineMap, installBlockRules } from './block-rules.ts';
import { installTableOfContents } from './toc.ts';
import { getFrontMatterRaw, setFrontMatterRaw, renderFrontMatterHtml } from './front-matter.ts';
import { slugify } from './text.ts';
import { numberedSectionHeadings, unwrapInlineHtmlBlocks, normalizeTableDelimiters, normalizeListIndent } from './preprocess.ts';
import { isGraphvizLang } from '../graphviz.ts';

// NOTE: `@hedgedoc/markdown-it-task-lists` is installed but unusable here —
// its compiled ESM entry does `import Token from 'markdown-it/lib/token.js'`
// which markdown-it@14 no longer exposes as a subpath, so Rollup can't
// resolve it. We implement the same behaviour inline below as a core rule,
// which also lets us attach `data-line` in the same pass.

type KatexPlugin = PluginWithOptions<{ throwOnError: boolean }>;
const katexPlugin = ((katex as unknown as { default?: KatexPlugin }).default ?? katex) as KatexPlugin;

// CJK-friendly emphasis (#262 / Gitee IKA1A0). `**Limit:**hard link` (full-width colon) renders as
// literal asterisks under stock CommonMark, and that shape is everywhere in
// Chinese writing: a bold run ending in a full-width colon, immediately
// followed by a Han character — no space, because CJK doesn't use one. The
// closing `**` is preceded by punctuation and followed by a letter, so it
// isn't right-flanking and can't close.
//
// `markdown-it-cjk-friendly` implements the CommonMark CJK amendment
// (commonmark/commonmark-spec#650), which reads those clauses as *non-CJK*
// punctuation. ASCII text keeps stock CommonMark behaviour — `**limit:**hard`
// stays literal — because nothing CJK is adjacent.



// `html: true` lets users embed inline HTML like
// `<img src=… style="zoom:50%;">`, `<details>`, `<sub>`, or table HTML for
// edge cases markdown can't express (issue #54) — that stays on, because
// breaking it would break real documents.
//
// #304 corrects the assumption the old comment made here ("this app only ever
// renders the user's own files — no untrusted input"): notes travel. Shared
// vaults, downloaded .md files, Git-synced folders and AI output all end up in
// this renderer, and `html: true` means `<img src=x onerror=…>` in any of them
// used to execute inside the webview — where `__TAURI_INTERNALS__.invoke`
// exposes the app's own file-read/write commands. So `renderMarkdown()` now
// runs its output through `sanitizeRenderedHtml()` (DOMPurify, configured in
// ./sanitize-html.ts to keep KaTeX MathML, inline SVG, highlight.js spans and
// our data-* plumbing), and tauri.conf.json carries a CSP that blocks inline
// script even if the sanitizer is bypassed.
export const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  // #141 — `breaks` is user-controlled (settings.markdownHardBreaks, default
  // ON = Typora-like: a single newline renders as a line break). This initial
  // value matches that default; the live value is synced from the settings
  // store via setMarkdownHardBreaks() (App.vue watchEffect) on hydration and
  // on toggle. Before 4.8.10 preview/exports used `false` while the Windows
  // live editor hardcoded `true` — the app disagreed with itself (#141).
  breaks: true,
  highlight: (code: string, lang: string): string => {
    // Mermaid blocks are handled after-render (processMermaid in Preview.vue)
    // and must keep the `language-mermaid` class untouched. Return '' so
    // markdown-it falls through to its default HTML-escape path for this
    // lang; the class is still emitted via langPrefix on the <code> tag.
    if (lang === 'mermaid' || isGraphvizLang(lang)) return '';
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
      } catch {}
    }
    // Unknown language: let hljs auto-detect for a best-effort highlight.
    try {
      return hljs.highlightAuto(code).value;
    } catch {
      return '';
    }
  },
})
  // front-matter must run first so it's stripped from the body before
  // any other plugin/rule sees it.
  .use(frontMatter, (fm: string) => {
    setFrontMatterRaw(fm);
  })
  .use(anchor, { permalink: false, slugify: (s: string) => slugify(s) })
  .use(katexPlugin, { throwOnError: false })
  .use(footnote)
  .use(mark)
  .use(cjkFriendly)
  .use(inlineFencePlugin);

installInlineRules(md);
installFenceRules(md);
installSourceLineMap(md);
installTableOfContents(md);
installBlockRules(md);

/** #141 — flip the global soft-newline behavior (preview, exports, live
 *  editor all share the `md` singleton). Called by the settings store sync. */
export function setMarkdownHardBreaks(on: boolean): void {
  md.set({ breaks: on });
}

// #216 — `typographer: true` also enables markdown-it's `smartquotes` rule,
// which rewrites straight quotes to curly ones (' → U+2019). Fonts that
// resolve U+2019 through a CJK fallback draw it fullwidth, so "test's"
// renders as "test'　s" — reported as "extra space after the apostrophe",
// and the preview stops matching the typed source. Curly quotes are opt-in
// now (settings.smartQuotes); the rest of typographer ((c) → ©, --- → —,
// ellipsis) is unaffected.
md.disable('smartquotes');

/** #216 — toggle curly-quote substitution; synced from the settings store. */
export function setMarkdownSmartQuotes(on: boolean): void {
  if (on) md.enable('smartquotes');
  else md.disable('smartquotes');
}

// ---- Numbered-section auto-headings (opt-in setting) ----------------------
// Chinese reports and official documents often write section numbers as plain text —
// `6.2 Export license management catalog` — with no `#`, so neither markdown-it nor Typora
// treat them as headings (a heading needs `#` + space; a bare number is just
// text). When the `markdownAutoNumberHeadings` setting is on we promote such
// lines to headings whose level tracks the numbering depth (`6.2` → h2,
// `6.2.1` → h3). Default OFF because auto-promotion is inherently heuristic
// (a line like `3.14 is pi` starts with a decimal too), so the user opts in.
let autoNumberHeadings = false;

/** Sync the numbered-heading toggle from the settings store. */
export function setMarkdownAutoNumberHeadings(on: boolean): void {
  autoNumberHeadings = on;
}

// Require ≥2 dot-joined numeric segments (`6.2`, `6.2.1`) so single-number
// sentences ("6 key points") and ordered-list markers (`1.`) are never touched.

/**
 * Run the source through every leniency preprocessor (inline-HTML-block
 * unwrapping #71, malformed table-delimiter repair, list re-indent #132) that
 * makes AI/PDF-exported Markdown render like Typora/Obsidian. Both the HTML
 * render path (`renderMarkdown`) and the DOCX token path (`markdownToDocxBlob`
 * via `md.parse`) must apply this identically, so it lives here as the single
 * source of truth. The numbered-section step is gated behind its opt-in
 * setting.
 */
export function preprocessMarkdown(source: string): string {
  let s = normalizeTableDelimiters(unwrapInlineHtmlBlocks(source || ''));
  if (autoNumberHeadings) s = numberedSectionHeadings(s);
  // `\label` / `\eqref` are LaTeX that KaTeX does not implement — resolve
  // them to `\tag` + anchors + links here so preview, PDF, Word and image
  // export all number equations the same way, from one place.
  s = numberEquations(s).text;
  return normalizeListIndent(s);
}

export function renderMarkdown(
  source: string,
  options?: { breaks?: boolean; tocSource?: string; blockNumbers?: boolean },
): string {
  setFrontMatterRaw(null);
  const normalized = preprocessMarkdown(source);
  const env: Record<string, unknown> = { solomdBlockNumbers: options?.blockNumbers === true };
  if (options?.tocSource !== undefined) {
    env.solomdTocSource = preprocessMarkdown(options.tocSource);
  }
  const prevBreaks = md.options.breaks;
  if (options?.breaks !== undefined) md.set({ breaks: options.breaks });
  let body = '';
  try {
    body = options?.blockNumbers
      ? renderNumberedBlocks(md.parse(normalized, env),
        (chunk) => md.renderer.render(chunk, md.options, env), documentDirection(normalized))
      : md.render(normalized, env);
  } finally {
    if (options?.breaks !== undefined) md.set({ breaks: prevBreaks });
  }
  const frontMatterRaw = getFrontMatterRaw();
  if (frontMatterRaw !== null) {
    const fmHtml = renderFrontMatterHtml(frontMatterRaw);
    setFrontMatterRaw(null);
    body = fmHtml + body;
  }
  // #304 — single choke point. Every consumer of rendered markdown (preview,
  // the live-block editor, slideshow, PDF/image/HTML export) goes through
  // here, so sanitizing the return value covers all of them at once.
  return sanitizeRenderedHtml(body);
}

/**
 * Extract the `imageRoot` field from a document's YAML front matter.
 * Supports aliases `image_root` and (Typora) `typora-root-url`.
 * Returns null if no front matter or no such field.
 *
 * Parsing is a minimal regex — we don't want a full YAML dep just for this.
 * Good enough for single-line string values like:
 *   imageRoot: ./images
 *   imageRoot: "D:\\blog\\assets"
 *   imageRoot: '/Users/foo/blog/assets'
 */
export function extractImageRoot(source: string): string | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!m) return null;
  const fm = m[1];
  const im = /^(?:imageRoot|image_root|typora-root-url)\s*:\s*(.+?)\s*$/m.exec(fm);
  if (!im) return null;
  return im[1].replace(/^["']|["']$/g, '').trim() || null;
}

export interface OutlineItem {
  level: number;
  text: string;
  slug: string;
  line: number;
}

export function extractOutline(source: string): OutlineItem[] {
  const lines = source.split('\n');
  const items: OutlineItem[] = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      const level = m[1].length;
      const text = m[2];
      items.push({ level, text, slug: slugify(text), line: i + 1 });
    }
  }
  return items;
}
