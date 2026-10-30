import type MarkdownIt from 'markdown-it';
import { documentDirection } from './doc-direction.ts';

// Source line mapping for split-pane scroll sync: annotate every block-level opening token
// with `data-source-line` (1-indexed). App.vue split-scroll maps editor lines to preview elements.
const BLOCK_OPEN_TYPES = new Set([
  'paragraph_open',
  'heading_open',
  'blockquote_open',
  'list_item_open',
  'bullet_list_open',
  'ordered_list_open',
  'table_open',
  'fence',
  'code_block',
  'hr',
  'html_block',
  'math_block',
]);

export function installSourceLineMap(md: MarkdownIt): void {
  md.core.ruler.push('source_line_map', (state) => {
    for (const tok of state.tokens) {
      if (!BLOCK_OPEN_TYPES.has(tok.type)) continue;
      if (!tok.map || tok.map.length < 1) continue;
      const line = tok.map[0] + 1; // 1-indexed
      tok.attrJoin('data-source-line', String(line));
    }
  });
}

export function installBlockRules(md: MarkdownIt): void {
  // Raw HTML blocks render their content verbatim — attrJoin above never reaches
  // the output, so documents built around `<div>…<img>…</div>` containers had no
  // sync anchors at all and the split panes drifted apart across those regions
  // (#203 split-pane misalignment). Wrap the raw block in a neutral div carrying the line.
  const defaultHtmlBlock = md.renderer.rules.html_block;
  md.renderer.rules.html_block = function (tokens, idx, options, env, self) {
    const html = defaultHtmlBlock
      ? defaultHtmlBlock(tokens, idx, options, env, self)
      : tokens[idx].content;
    const tok = tokens[idx];
    const line = tok.map && tok.map.length > 0 ? tok.map[0] + 1 : 0;
    if (!line) return html;
    return `<div data-source-line="${line}">${html}</div>`;
  };

  // Custom core rule: detect GitHub-style task list items (a leading
  // `[ ]` / `[x]` in the first inline child of a list item) and:
  //   1. add a `task-list-item` class to the <li>
  //   2. replace the `[ ] ` / `[x] ` text prefix with an <input type="checkbox">
  //   3. attach `data-line="N"` (1-indexed source line) to the <li>
  // We also tag the enclosing <ul>/<ol> with `contains-task-list` so
  // integrators can strip bullet markers.
  // #271 — short table cells don't wrap. The browser's table layout promises a
  // column only its min-content width, which for Chinese is ONE character, so a
  // short label beside a long column was squeezed until it read top to bottom
  // ("one character per line"). A cell whose text is short — up to ~12 CJK characters or
  // ~24 Latin ones — is kept on one line; longer cells wrap as before, so a
  // wide table still fits its page.
  const SHORT_CELL_WIDTH = 24;
  function displayWidth(text: string): number {
    let w = 0;
    for (const ch of text) w += /[\u2E80-\uA4CF\uAC00-\uD7AF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]/.test(ch) ? 2 : 1;
    return w;
  }
  md.core.ruler.after('inline', 'table_short_cells', (state) => {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length - 1; i++) {
      const tok = tokens[i];
      if (tok.type !== 'td_open' && tok.type !== 'th_open') continue;
      const inline = tokens[i + 1];
      if (inline.type !== 'inline') continue;
      // Measure what is shown, not the markup: `**x**` is one character wide.
      const shown = (inline.children ?? [])
        .map((c) => (c.type === 'text' || c.type === 'code_inline' ? c.content : ''))
        .join('');
      if (shown && displayWidth(shown) <= SHORT_CELL_WIDTH) tok.attrJoin('class', 'cell-nowrap');
    }
  });

  md.core.ruler.after('inline', 'task_lists', (state) => {
    const tokens = state.tokens;
    const TASK_RE = /^\[([ xX])\][ \u00A0]/;

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      if (tok.type !== 'list_item_open') continue;

      // The first content of a list item is typically:
      //   list_item_open -> paragraph_open -> inline -> paragraph_close -> ...
      // We want the `inline` token's first child to be a text token
      // starting with `[ ] ` or `[x] `.
      const paragraphOpen = tokens[i + 1];
      const inlineTok = tokens[i + 2];
      if (
        !paragraphOpen ||
        paragraphOpen.type !== 'paragraph_open' ||
        !inlineTok ||
        inlineTok.type !== 'inline' ||
        !inlineTok.children ||
        inlineTok.children.length === 0
      ) {
        continue;
      }
      const firstChild = inlineTok.children[0];
      if (firstChild.type !== 'text') continue;
      const m = TASK_RE.exec(firstChild.content);
      if (!m) continue;

      const checked = m[1] !== ' ';
      // Strip the `[ ] ` / `[x] ` prefix from the text token.
      firstChild.content = firstChild.content.slice(m[0].length);

      // Insert an html_inline checkbox at the start of the inline children.
      const checkboxToken = new state.Token('html_inline', '', 0);
      checkboxToken.content = `<input class="task-list-item-checkbox" type="checkbox"${
        checked ? ' checked=""' : ''
      } disabled=""> `;
      inlineTok.children.unshift(checkboxToken);

      // Tag the <li>.
      const existingClass = tok.attrGet('class');
      tok.attrSet(
        'class',
        existingClass ? `${existingClass} task-list-item` : 'task-list-item',
      );
      const line = tok.map && tok.map.length > 0 ? tok.map[0] + 1 : 0;
      tok.attrSet('data-line', String(line));

      // Walk back to find the enclosing list token and tag it.
      for (let k = i - 1; k >= 0; k--) {
        const p = tokens[k];
        if (p.type === 'bullet_list_open' || p.type === 'ordered_list_open') {
          const cls = p.attrGet('class');
          if (!cls || !/\bcontains-task-list\b/.test(cls)) {
            p.attrSet(
              'class',
              cls ? `${cls} contains-task-list` : 'contains-task-list',
            );
          }
          break;
        }
        if (p.type === 'bullet_list_close' || p.type === 'ordered_list_close') {
          break;
        }
      }
    }
    return false;
  });

  // GitHub-style callouts: a blockquote whose first line is `[!NOTE]` (or TIP /
  // IMPORTANT / WARNING / CAUTION) renders as a tinted callout card with a
  // label row — the syntax GitHub and Obsidian users expect to just work. The
  // marker line is stripped; the label/icon comes from CSS (`.md-callout`) so
  // every consumer of the rendered HTML (preview, live blocks, print overlay)
  // styles it without extra plumbing. Unknown `[!TYPES]` are left as plain
  // blockquote text on purpose.
  md.core.ruler.after('inline', 'github_callouts', (state) => {
    const tokens = state.tokens;
    const CALLOUT_RE = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*/i;
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].type !== 'blockquote_open') continue;
      const pOpen = tokens[i + 1];
      const inline = tokens[i + 2];
      if (
        !pOpen ||
        pOpen.type !== 'paragraph_open' ||
        !inline ||
        inline.type !== 'inline' ||
        !inline.children ||
        inline.children.length === 0
      ) {
        continue;
      }
      const first = inline.children[0];
      if (first.type !== 'text') continue;
      const m = CALLOUT_RE.exec(first.content);
      if (!m) continue;
      const kind = m[1].toLowerCase();
      tokens[i].attrJoin('class', `md-callout md-callout--${kind}`);
      first.content = first.content.slice(m[0].length);
      if (first.content === '') {
        // Marker sat alone on its line — drop the empty text node and the
        // line break that followed it so the body starts flush.
        const next = inline.children[1];
        inline.children.splice(0, next && (next.type === 'softbreak' || next.type === 'hardbreak') ? 2 : 1);
      }
    }
  });

  // Hebrew / Arabic: a mostly-RTL document renders right-to-left end to end,
  // English blocks included (see documentDirection). Only `rtl` is ever written:
  // an LTR render leaves blocks untouched, so a live-edit fragment rendered on
  // its own inherits the editor's whole-file direction instead of overriding it.
  // Fenced code stays LTR; indented blocks follow the document direction.
  const DIR_BLOCK_TYPES = new Set([
    'code_block',
    'paragraph_open',
    'heading_open',
    'blockquote_open',
    'bullet_list_open',
    'ordered_list_open',
    'list_item_open',
    'table_open',
  ]);

  md.core.ruler.push('doc_dir', (state) => {
    if (documentDirection(state.src) !== 'rtl') return;
    for (const tok of state.tokens) {
      if (DIR_BLOCK_TYPES.has(tok.type)) tok.attrSet('dir', 'rtl');
    }
  });
}
