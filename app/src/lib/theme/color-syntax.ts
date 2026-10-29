const HEX_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NUMERIC_FN_RE = /^(?:rgba?|hsla?)\(\s*[\d.]+(?:deg|%)?(?:\s*[,/\s]\s*[\d.]+(?:deg|%)?)*\s*\)$/i;
const MIX_OPEN_RE = /^color-mix\(\s*in\s+[a-z0-9-]+(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?\s*,/i;
const PERCENT_RE = /^\d+(?:\.\d+)?%$/;
const TRANSPARENT = 'transparent';
const MIX_ARG_COUNT = 2;

function splitTopLevel(text: string): string[] | null {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth += 1;
    if (text[i] === ')') depth -= 1;
    if (depth < 0) return null;
    if (text[i] === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return depth === 0 ? parts : null;
}

function isMixArg(arg: string): boolean {
  const text = arg.trim();
  const tail = text.match(/\s+(\S+)$/);
  if (tail && PERCENT_RE.test(tail[1])) return isAllowedColor(text.slice(0, tail.index));
  return isAllowedColor(text);
}

function isColorMix(text: string): boolean {
  const open = text.match(MIX_OPEN_RE);
  if (!open || !text.endsWith(')')) return false;
  const args = splitTopLevel(text.slice(open[0].length, -1));
  return args !== null && args.length === MIX_ARG_COUNT && args.every(isMixArg);
}

export function isAllowedColor(value: string): boolean {
  const text = value.trim();
  if (text.toLowerCase() === TRANSPARENT) return true;
  if (HEX_RE.test(text)) return true;
  if (NUMERIC_FN_RE.test(text)) return true;
  return isColorMix(text);
}
