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
const FENCE_OPEN = /^\s*(`{3,}|~{3,})/;
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
const KEEP_CAPTURE = '$1';
const FOOTNOTE_REF = /\[\^[^\]]+\]/g;
const REPEATED_SPACES = / {2,}/g;
const SINGLE_SPACE = ' ';
const GRAMMAR_LEAD = /^(?:\}\S*|=>|>)\s*/;
const SINGLE_LINE_COMMENT = 'single';
const EMPTY_BLOCK = 'empty';
const INLINE_RULES: [RegExp, string][] = [
  [/!\[([^\]]*)\]\([^)]*\)/g, KEEP_CAPTURE],
  [/\[([^\]]+)\]\([^)]*\)/g, KEEP_CAPTURE],
  [/\*\*(.+?)\*\*/g, KEEP_CAPTURE],
  [/__(.+?)__/g, KEEP_CAPTURE],
  [/~~(.+?)~~/g, KEEP_CAPTURE],
  [/`([^`]*)`/g, KEEP_CAPTURE],
];

export function plainInline(text: string): string {
  const stripped = INLINE_RULES.reduce((acc, [pattern, replacement]) => acc.replace(pattern, replacement), text);
  return stripped.replace(FOOTNOTE_REF, '').replace(REPEATED_SPACES, SINGLE_SPACE).trim();
}

function safeTopic(text: string): string {
  let topic = text;
  while (GRAMMAR_LEAD.test(topic)) topic = topic.replace(GRAMMAR_LEAD, '');
  return topic;
}

function indentOf(line: string): number {
  const ws = LEADING_WS.exec(line)?.[0] ?? '';
  return [...ws].reduce((width, ch) => width + (ch === '\t' ? TAB_WIDTH : 1), 0);
}

function fenceSkip(line: string): Skip {
  const marker = FENCE_OPEN.exec(line)?.[1];
  if (!marker) return null;
  const close = new RegExp(`^\\s*${marker[0] === '`' ? '`' : '~'}{${marker.length},}\\s*$`);
  return { until: (next) => close.test(next) };
}

function commentSkip(line: string): Skip | typeof SINGLE_LINE_COMMENT {
  if (!line.trimStart().startsWith(COMMENT_OPEN)) return null;
  if (line.includes(COMMENT_CLOSE)) return SINGLE_LINE_COMMENT;
  return { until: (next) => next.includes(COMMENT_CLOSE) };
}

function headingBlock(line: string, at: number): MdBlock | typeof EMPTY_BLOCK | null {
  const match = HEADING.exec(line);
  if (!match) return null;
  const text = safeTopic(plainInline(match[2].replace(ATTRIBUTE_BLOCK, '').replace(CLOSING_HASHES, '')));
  if (text === '') return EMPTY_BLOCK;
  return { kind: 'heading', level: match[1].length, text, line: at };
}

function itemBlock(line: string, at: number): MdBlock | typeof EMPTY_BLOCK | null {
  const match = ITEM.exec(line);
  if (!match) return null;
  const box = TASK_BOX.exec(match[3]);
  const body = box ? match[3].slice(box[0].length) : match[3];
  const prefix = box ? (box[1] === ' ' ? TASK_OPEN : TASK_DONE) : '';
  const text = safeTopic(plainInline(body));
  if (text === '') return EMPTY_BLOCK;
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
  if (heading === EMPTY_BLOCK) return null;
  if (heading) return heading;
  const item = itemBlock(line, at);
  if (item === EMPTY_BLOCK) return null;
  return item ?? textBlock(line, at);
}

function frontMatterEnd(lines: string[], firstLine: number): number {
  if (firstLine !== DEFAULT_FIRST_LINE) return 0;
  if (lines[0]?.trim() !== FRONT_MATTER_OPEN) return 0;
  const close = lines.findIndex((line, i) => i > 0 && FRONT_MATTER_CLOSE.test(line));
  return close < 0 ? 0 : close + 1;
}

export function scanMarkdown(source: string, firstLine: number = DEFAULT_FIRST_LINE): MdBlock[] {
  const lines = source.split(/\r?\n/);
  const blocks: MdBlock[] = [];
  let skip: Skip = null;
  for (let i = frontMatterEnd(lines, firstLine); i < lines.length; i += 1) {
    const line = lines[i];
    if (skip) { if (skip.until(line)) skip = null; continue; }
    const comment = commentSkip(line);
    if (comment) { skip = comment === SINGLE_LINE_COMMENT ? null : comment; continue; }
    skip = fenceSkip(line);
    if (skip) continue;
    const block = blockFor(line, firstLine + i);
    if (block) blocks.push(block);
  }
  return blocks;
}

export function linesOutsideFences(source: string): { text: string; line: number }[] {
  const lines = source.split(/\r?\n/);
  const kept: { text: string; line: number }[] = [];
  let skip: Skip = null;
  lines.forEach((text, i) => {
    if (skip) { if (skip.until(text)) skip = null; return; }
    skip = fenceSkip(text);
    if (!skip) kept.push({ text, line: i + 1 });
  });
  return kept;
}

export function fenceRanges(source: string): { from: number; to: number }[] {
  const lines = source.split(/\r?\n/);
  const ranges: { from: number; to: number }[] = [];
  let skip: Skip = null;
  let from = 0;
  lines.forEach((text, i) => {
    if (skip) {
      if (!skip.until(text)) return;
      ranges.push({ from, to: i + 1 });
      skip = null;
      return;
    }
    skip = fenceSkip(text);
    if (skip) from = i + 1;
  });
  if (skip) ranges.push({ from, to: lines.length });
  return ranges;
}
