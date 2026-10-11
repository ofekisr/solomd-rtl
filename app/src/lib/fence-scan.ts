const OPEN_PATTERN = /^( {0,3})(`{3,}|~{3,})(.*?)\r?$/;
const BACKTICK = '`';
const NEWLINE = '\n';

export interface FencedBlock {
  info: string;
  indent: string;
  line: number;
  from: number;
  to: number;
  bodyFrom: number;
  bodyTo: number;
  body: string;
}

interface Opening { indent: string; run: string; info: string }

function lineStarts(lines: string[]): number[] {
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + NEWLINE.length;
  }
  return starts;
}

function parseOpening(line: string): Opening | null {
  const match = OPEN_PATTERN.exec(line);
  if (!match) return null;
  const [, indent, run, rest] = match;
  if (run[0] === BACKTICK && rest.includes(BACKTICK)) return null;
  return { indent, run, info: rest.trim() };
}

function closes(line: string, run: string): boolean {
  const pattern = new RegExp(`^ {0,3}\\${run[0]}{${run.length},}\\s*$`);
  return pattern.test(line);
}

function dedent(line: string, indent: string): string {
  let cut = 0;
  while (cut < indent.length && line[cut] === ' ') cut += 1;
  return line.slice(cut);
}

function findClose(lines: string[], start: number, run: string): number {
  for (let i = start; i < lines.length; i += 1) if (closes(lines[i], run)) return i;
  return -1;
}

export function scanFencedBlocks(source: string): FencedBlock[] {
  const lines = source.split(NEWLINE);
  const starts = lineStarts(lines);
  const blocks: FencedBlock[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const open = parseOpening(lines[i]);
    if (!open) continue;
    const close = findClose(lines, i + 1, open.run);
    if (close < 0) return blocks;
    const body = lines.slice(i + 1, close).map((l) => dedent(l, open.indent)).join(NEWLINE);
    blocks.push({ info: open.info, indent: open.indent, line: i, from: starts[i], to: starts[close] + lines[close].length, bodyFrom: starts[i + 1], bodyTo: starts[close], body });
    i = close;
  }
  return blocks;
}
