import type MarkdownIt from 'markdown-it';
import type Token from 'markdown-it/lib/token.mjs';
import type Renderer from 'markdown-it/lib/renderer.mjs';
import hljs from '../hljs-languages.ts';
import { isTerminalLang, renderTerminalBlock } from '../terminal-block.ts';
import { isGraphvizLang } from '../graphviz.ts';

// v4.3.0 issue #65: wrap each line of a rendered fence in a <span
// class="cb-line"> so a CSS counter can display line numbers when the
// `codeBlockLineNumbers` setting is on. The CSS is gated by a
// `cb-numbered` class added to <pre> here and `cb-numbered-on` on the
// `.preview-content` root — so flipping the setting is a pure-CSS swap,
// no re-render needed.
function highlightShell(command: string): string {
  return hljs.highlight(command, { language: 'bash', ignoreIllegals: true }).value;
}

function renderTerminalFence(tok: Token, self: Renderer): string | null {
  const [lang = '', ...titleWords] = (tok.info || '').trim().split(/\s+/);
  if (!isTerminalLang(lang)) return null;
  return renderTerminalBlock(tok.content, {
    title: titleWords.join(' '),
    highlight: highlightShell,
    attrs: self.renderAttrs(tok),
  });
}

export function installFenceRules(md: MarkdownIt): void {
  const defaultFenceRenderer = md.renderer.rules.fence;
  md.renderer.rules.fence = function (tokens, idx, options, env, self) {
    const terminal = renderTerminalFence(tokens[idx], self);
    if (terminal) return terminal;
    const rendered = defaultFenceRenderer
      ? defaultFenceRenderer(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
    const html = env.solomdBlockNumbers
      ? rendered.replace(/<pre(?=[\s>])/, '<pre dir="ltr"')
      : rendered;
    // Skip mermaid — Preview.vue replaces these blocks with rendered SVGs.
    // Skip tldraw (F7) the same way — Preview.vue swaps the ```tldraw fence for
    // a static board SVG thumbnail (the language class survives so the
    // post-processor can find it). Skip mindmap the same way — Preview.vue mounts a read-only map.
    const tok = tokens[idx];
    const info = (tok.info || '').trim().toLowerCase();
    const lang = info.split(/\s+/)[0];
    if (lang === 'mermaid' || lang === 'tldraw' || lang === 'mindmap' || isGraphvizLang(lang)) return html;
    // Inject .cb-line wrappers on each line. We do this on the rendered HTML
    // because the highlight has already produced <span class="hljs-..."> spans
    // that may straddle multiple lines (a few hljs grammars emit multi-line
    // comment/string spans). A naive split on '\n' leaves those spans
    // unbalanced, and the browser then NESTS every later line inside line 1
    // (#164 — the whole block collapsed into the first numbered row). So we
    // tokenize: at each newline, close the currently-open spans, emit the line,
    // and reopen them on the next one — every .cb-line is self-contained.
    return html.replace(/<code([^>]*)>([\s\S]*?)<\/code>/, (_m, codeAttrs, inner) => {
      // Strip the trailing newline if any so we don't render an empty
      // line-numbered row at the end.
      // The newline can sit *inside* a highlight span that runs to the end of
      // the block ("…\n</span>"), so look past closing tags for it.
      const trimmed = inner.replace(/\n((?:<\/span>)*)$/, '$1');
      const openSpans: string[] = [];
      let out = '';
      let line = '';
      const flush = () => {
        // #190 — a blank line inside a multi-line highlight span is not an empty
        // string, it is `<span class="hljs-code"></span>`: no text, so no line
        // box, and its number landed on top of the next one. Judge emptiness by
        // the text, not the markup.
        const blank = line.replace(/<[^>]*>/g, '') === '';
        out += `<span class="cb-line">${blank ? `${line} ` : line}</span>`;
        line = '';
      };
      for (const tok of trimmed.match(/<span\b[^>]*>|<\/span>|\n|[^<\n]+|</g) ?? []) {
        if (tok === '\n') {
          line += '</span>'.repeat(openSpans.length);
          flush();
          out += '\n';
          line = openSpans.join('');
        } else if (tok.startsWith('<span')) {
          openSpans.push(tok);
          line += tok;
        } else if (tok === '</span>') {
          openSpans.pop();
          line += tok;
        } else {
          line += tok;
        }
      }
      flush();
      return `<code${codeAttrs}>${out}</code>`;
    })
      // Add cb-numbered class on the <pre> so CSS can scope the counter.
      .replace(/<pre>/, '<pre class="cb-numbered">');
  };

  // v4.6 — editable display math. Wrap every `$$…$$` block in a container that
  // carries its 1-indexed source line, so Preview.vue can map a double-clicked
  // formula back to its source range and open an inline LaTeX editor (like
  // Tolaria's "editable math source panel"). The default markdown-it-katex
  // math_block renderer doesn't propagate token attrs, so we wrap explicitly.
  const defaultMathBlock = md.renderer.rules.math_block;
  md.renderer.rules.math_block = function (tokens, idx, options, env, self) {
    const html = defaultMathBlock
      ? defaultMathBlock(tokens, idx, options, env, self)
      : self.renderToken(tokens, idx, options);
    const tok = tokens[idx];
    const line = tok.map && tok.map.length > 0 ? tok.map[0] + 1 : 0;
    if (!line) return html;
    return `<div class="md-math-block" data-source-line="${line}">${html}</div>`;
  };
}
