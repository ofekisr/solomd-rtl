import type Token from 'markdown-it/lib/token.mjs';
import type { TextDirection } from './doc-direction.ts';

const FIRST_BLOCK_NUMBER = 1;
const COUNTED_TYPES = new Set([
  'paragraph_open', 'heading_open', 'bullet_list_open',
  'ordered_list_open', 'blockquote_open', 'table_open',
  'fence', 'code_block', 'html_block', 'math_block',
]);

export function isFullMdFile(filePath: string | undefined): boolean {
  const name = filePath?.split(/[\\/]/).pop();
  return name?.toLowerCase().endsWith('.full.md') ?? false;
}

function endOfBlock(tokens: Token[], start: number): number {
  if (tokens[start].nesting !== 1) return start + 1;
  let depth = 0;
  for (let index = start; index < tokens.length; index += 1) {
    depth += tokens[index].nesting;
    if (depth === 0) return index + 1;
  }
  return tokens.length;
}

function isCounted(token: Token): boolean {
  return token.map !== null && COUNTED_TYPES.has(token.type)
    && !(token.type === 'heading_open' && token.tag === 'h1');
}

export function renderNumberedBlocks(
  tokens: Token[],
  render: (tokens: Token[]) => string,
  direction: TextDirection = 'ltr',
): string {
  let number = FIRST_BLOCK_NUMBER;
  let output = '';
  for (let start = 0; start < tokens.length;) {
    const end = endOfBlock(tokens, start);
    const html = render(tokens.slice(start, end));
    output += isCounted(tokens[start])
      ? `<div class="full-md-block" data-block-number="${number++}" dir="${direction}">${html}</div>`
      : html;
    start = end;
  }
  return output;
}
