export type MdBlock =
  | { kind: 'heading'; level: number; text: string; line: number }
  | { kind: 'item'; indent: number; text: string; line: number }
  | { kind: 'text'; indent: number; text: string; line: number }
  | { kind: 'blank'; line: number };

type Skip = { until: (line: string) => boolean } | null;

const DEFAULT_FIRST_LINE = 1;
const TAB_WIDTH = 4;
const FRONT_MATTER_OPEN = '---';
const FRONT_MATTER_CLOSE = /^(?:---|\.\.\.)\s*$/;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const COMMENT_OPEN = '<!--';
const COMMENT_CLOSE = '-->';
const SKIPPED_LINE = [/^\s*:{3,}/, /^\s*([-*_])(\s*\1){2,}\s*$/];
const TABLE_ROW = /^\s*\|/;
const HEADING = /^ {0,3}(#{1,6})\s+(.+?)\s*$/;
const CLOSING_HASHES = /\s+#+$/;
const ATTRIBUTE_BLOCK = /\s*\{[^{}]*\}$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TASK_BOX = /^\[([ xX])\]\s+/;
const TASK_OPEN = '☐ ';
const TASK_DONE = '☑ ';
const QUOTE_MARKER = /^\s*>\s?/;
const LINE_BLOCK = /^\|\s?/;
const SUBHEADING = /^\[(.+)\]\{\.subheading\}$/;
const LEADING_WS = /^[ \t]*/;
const INLINE_RULES: [RegExp, string][] = [
  [/!\[([^\]]*)\]\([^)]*\)/g, '$1'],
  [/\[([^\]]+)\]\([^)]*\)/g, '$1'],
  [/\*\*(.+?)\*\*/g, '$1'],
  [/__(.+?)__/g, '$1'],
  [/~~(.+?)~~/g, '$1'],
  [/`([^`]*)`/g, '$1'],
];

export function plainInline(text: string): string {
  return INLINE_RULES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text).trim();
}

function indentOf(line: string): number {
  const ws = LEADING_WS.exec(line)?.[0] ?? '';
  return [...ws].reduce((width, ch) => width + (ch === '\t' ? TAB_WIDTH : 1), 0);
}

function fenceSkip(line: string): Skip {
  const marker = FENCE_OPEN.exec(line)?.[1];
  if (!marker) return null;
  const close = new RegExp(`^ {0,3}${marker[0] === '`' ? '`' : '~'}{${marker.length},}\\s*$`);
  return { until: (next) => close.test(next) };
}

function commentSkip(line: string): Skip | 'single' {
  if (!line.trimStart().startsWith(COMMENT_OPEN)) return null;
  if (line.includes(COMMENT_CLOSE)) return 'single';
  return { until: (next) => next.includes(COMMENT_CLOSE) };
}

function headingBlock(line: string, at: number): MdBlock | null {
  const match = HEADING.exec(line);
  if (!match) return null;
  const text = plainInline(match[2].replace(CLOSING_HASHES, '').replace(ATTRIBUTE_BLOCK, ''));
  return { kind: 'heading', level: match[1].length, text, line: at };
}

function itemBlock(line: string, at: number): MdBlock | 'empty' | null {
  const match = ITEM.exec(line);
  if (!match) return null;
  const box = TASK_BOX.exec(match[3]);
  const body = box ? match[3].slice(box[0].length) : match[3];
  const prefix = box ? (box[1] === ' ' ? TASK_OPEN : TASK_DONE) : '';
  const text = plainInline(body);
  if (text === '') return 'empty';
  return { kind: 'item', indent: indentOf(line), text: `${prefix}${text}`, line: at };
}

function textBlock(line: string, at: number): MdBlock | null {
  let body = line;
  while (QUOTE_MARKER.test(body)) body = body.replace(QUOTE_MARKER, '');
  if (body !== line) body = body.replace(LINE_BLOCK, '');
  else if (TABLE_ROW.test(body)) return null;
  const sub = SUBHEADING.exec(body.trim());
  const text = plainInline(sub ? sub[1] : body);
  if (text === '') return { kind: 'blank', line: at };
  return { kind: 'text', indent: indentOf(line), text, line: at };
}

function blockFor(line: string, at: number): MdBlock | null {
  if (SKIPPED_LINE.some((pattern) => pattern.test(line))) return null;
  const heading = headingBlock(line, at);
  if (heading) return heading;
  const item = itemBlock(line, at);
  if (item === 'empty') return null;
  return item ?? textBlock(line, at);
}

function frontMatterEnd(lines: string[]): number {
  if (lines[0]?.trim() !== FRONT_MATTER_OPEN) return 0;
  const close = lines.findIndex((line, i) => i > 0 && FRONT_MATTER_CLOSE.test(line));
  return close < 0 ? 0 : close + 1;
}

export function scanMarkdown(source: string, firstLine: number = DEFAULT_FIRST_LINE): MdBlock[] {
  const lines = source.split(/\r?\n/);
  const blocks: MdBlock[] = [];
  let skip: Skip = null;
  for (let i = frontMatterEnd(lines); i < lines.length; i += 1) {
    const line = lines[i];
    if (skip) { if (skip.until(line)) skip = null; continue; }
    const comment = commentSkip(line);
    if (comment) { skip = comment === 'single' ? null : comment; continue; }
    skip = fenceSkip(line);
    if (skip) continue;
    const block = blockFor(line, firstLine + i);
    if (block) blocks.push(block);
  }
  return blocks;
}
