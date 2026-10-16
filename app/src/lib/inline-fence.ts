import type MarkdownIt from 'markdown-it';
import type StateBlock from 'markdown-it/lib/rules_block/state_block.mjs';

/**
 * Single-line code fence: ```lang; code``` (the colon form ```:lang; code```
 * works too). CommonMark has no such thing — a backtick fence's info string
 * may not contain backticks, so the line is otherwise an inline code span —
 * which is exactly why it never collides with a real fence.
 */
export interface InlineFence {
  lang: string;
  code: string;
}

const INLINE_FENCE_RE = /^ {0,3}(`{3,}):?([A-Za-z0-9_+.#-]+);[ \t]?(.*?)[ \t]*\1[ \t]*$/;
const FENCE_LINE_RE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

export function parseInlineFence(line: string): InlineFence | null {
  const m = INLINE_FENCE_RE.exec(line);
  if (!m || !m[3] || m[3].includes(m[1])) return null;
  return { lang: m[2], code: m[3] };
}

/** Single-line fences by 0-based line index, skipping lines inside real fences. */
export function findInlineFences(lines: readonly string[]): Map<number, InlineFence> {
  const found = new Map<number, InlineFence>();
  let open: { char: string; len: number } | null = null;
  lines.forEach((line, index) => {
    const fence = FENCE_LINE_RE.exec(line);
    if (open) {
      if (fence && fence[1][0] === open.char && fence[1].length >= open.len && !fence[2].trim()) open = null;
      return;
    }
    const inline = parseInlineFence(line);
    if (inline) {
      found.set(index, inline);
      return;
    }
    if (fence && !(fence[1][0] === '`' && fence[2].includes('`'))) {
      open = { char: fence[1][0], len: fence[1].length };
    }
  });
  return found;
}

function inlineFenceRule(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  const from = state.bMarks[startLine] + state.tShift[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const lineText = state.src.slice(state.bMarks[startLine], state.eMarks[startLine]);
  const parsed = parseInlineFence(lineText);
  if (!parsed || state.src.charCodeAt(from) !== 0x60) return false;
  if (silent) return true;
  const token = state.push('fence', 'code', 0);
  token.info = parsed.lang;
  token.content = `${parsed.code}\n`;
  token.markup = '```';
  token.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
}

export function inlineFencePlugin(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'inline_fence', inlineFenceRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
}
