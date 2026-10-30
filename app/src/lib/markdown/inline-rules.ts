import type MarkdownIt from 'markdown-it';

export function installInlineRules(md: MarkdownIt): void {
  // ---- Wikilink rule (`[[X]]`, `[[X|alias]]`, `[[X#heading]]`) ---------------
  // Used by F1 (v2.0). Renders into <a class="md-wikilink" data-wikilink-target="X">…</a>.
  // Preview.vue intercepts clicks and resolves through the workspace index.
  md.inline.ruler.before('link', 'wikilink', (state, silent) => {
    const start = state.pos;
    const src = state.src;
    if (src.charCodeAt(start) !== 0x5b /* [ */) return false;
    if (src.charCodeAt(start + 1) !== 0x5b) return false;
    // Find closing `]]` on the same line. Disallow nested `[`.
    const max = state.posMax;
    let i = start + 2;
    while (i < max - 1) {
      const ch = src.charCodeAt(i);
      if (ch === 0x0a) return false; // newline
      if (ch === 0x5b) return false; // nested [
      if (ch === 0x5d && src.charCodeAt(i + 1) === 0x5d) {
        // Found closing ]]
        const inner = src.slice(start + 2, i).trim();
        if (!inner) return false;
        if (silent) {
          state.pos = i + 2;
          return true;
        }
        // Parse target / heading / alias
        let target = inner;
        let alias: string | null = null;
        let heading: string | null = null;
        const pipe = target.indexOf('|');
        if (pipe >= 0) {
          alias = target.slice(pipe + 1).trim() || null;
          target = target.slice(0, pipe).trim();
        }
        const hash = target.indexOf('#');
        if (hash >= 0) {
          heading = target.slice(hash + 1).trim() || null;
          target = target.slice(0, hash).trim();
        }
        const display = alias || (heading ? `${target}#${heading}` : target);
        const tokOpen = state.push('wikilink_open', 'a', 1);
        tokOpen.attrSet('class', 'md-wikilink');
        tokOpen.attrSet('href', '#');
        tokOpen.attrSet('data-wikilink-target', target);
        if (heading) tokOpen.attrSet('data-wikilink-heading', heading);
        const tokText = state.push('text', '', 0);
        tokText.content = display;
        state.push('wikilink_close', 'a', -1);
        state.pos = i + 2;
        return true;
      }
      i++;
    }
    return false;
  });

  // ---- Image with a space in its path (#345) -----------------------------------
  // CommonMark doesn't allow a space in a bare link destination, so
  // `![](D:/Program Files/a.png)` renders as literal text. SoloMD used to write
  // exactly that when pasting into an image folder whose path had a space (it
  // now percent-encodes, see md-image-url.ts), so notes in the wild still carry
  // such links. Accept them as images — but only when the destination is a
  // single line, has no quotes, parentheses or angle brackets, and ends in an
  // image extension. Under the standard grammar that text can only ever render
  // as the raw characters, so nothing that works today changes meaning.
  const SPACED_IMAGE_RE =
    /^!\[([^\]\n]*)\]\(\s*([^()<>"'\n]*?\s[^()<>"'\n]*?\.(?:png|jpe?g|gif|webp|svg|bmp|avif|ico|tiff?))\s*\)/i;
  md.inline.ruler.before('image', 'image_spaced_path', (state, silent) => {
    if (state.src.charCodeAt(state.pos) !== 0x21 /* ! */) return false;
    const m = SPACED_IMAGE_RE.exec(state.src.slice(state.pos, state.posMax));
    if (!m) return false;
    const href = state.md.normalizeLink(m[2]);
    if (!state.md.validateLink(href)) return false;
    if (!silent) {
      const children: typeof state.tokens = [];
      state.md.inline.parse(m[1], state.md, state.env, children);
      const token = state.push('image', 'img', 0);
      token.attrs = [['src', href], ['alt', '']];
      token.children = children;
      token.content = m[1];
    }
    state.pos += m[0].length;
    return true;
  });
}
