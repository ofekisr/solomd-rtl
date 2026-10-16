/**
 * Shared find / replace semantics for in-editor targets (CodeMirror, mind map).
 * Matching is line-by-line, like folder search in `search.rs`, so `^` / `$`
 * mean start / end of line everywhere. `\w` / `\d` are widened to Unicode so
 * Hebrew and Arabic letters count as word characters, matching Rust `regex`.
 */

export interface FindSpec {
  search: string;
  replace: string;
  caseSensitive: boolean;
  regexp: boolean;
}

export interface FindCounter {
  index: number;
  total: number;
}

/** What the find bar drives: CodeMirror in a text tab, the canvas in a map tab. */
export interface FindTarget {
  readonly supportsNamedGroups: boolean;
  setSpec(spec: FindSpec): void;
  isValid(spec: FindSpec): boolean;
  counter(spec: FindSpec): FindCounter;
  next(): void;
  prev(): void;
  replaceOne(): void;
  replaceAll(): void;
  close(): void;
}

const WORD_CLASS_BODY = '\\p{L}\\p{N}\\p{M}_';
const UNICODE_CLASSES: Record<string, { outside: string; inside: string | null }> = {
  w: { outside: `[${WORD_CLASS_BODY}]`, inside: WORD_CLASS_BODY },
  W: { outside: `[^${WORD_CLASS_BODY}]`, inside: null },
  d: { outside: '\\p{Nd}', inside: '\\p{Nd}' },
};

/** Rewrite `\w`, `\W`, `\d` to Unicode property classes (needs the `u` flag). */
export function unicodeClasses(pattern: string): string {
  let out = '';
  let inClass = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '\\' && i + 1 < pattern.length) {
      const next = pattern[i + 1];
      const mapped = UNICODE_CLASSES[next];
      const replacement = mapped && (inClass ? mapped.inside : mapped.outside);
      out += replacement ?? c + next;
      i++;
      continue;
    }
    if (c === '[' && !inClass) inClass = true;
    else if (c === ']' && inClass) inClass = false;
    out += c;
  }
  return out;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** `null` for an empty or invalid pattern. */
export function compileFind(spec: FindSpec): RegExp | null {
  if (!spec.search) return null;
  const source = spec.regexp ? unicodeClasses(spec.search) : escapeRegExp(spec.search);
  try {
    return new RegExp(source, `gu${spec.caseSensitive ? '' : 'i'}`);
  } catch {
    return null;
  }
}

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', '\\': '\\' };

/** The string handed to `String.prototype.replace`: `\n` / `\t` unescaped in
 *  regex mode, `$` made literal in plain mode. */
export function replacementFor(spec: FindSpec): string {
  if (!spec.regexp) return spec.replace.replace(/\$/g, '$$$$');
  return spec.replace.replace(/\\([nt\\])/g, (_, ch: string) => ESCAPES[ch]);
}

export function lineMatches(text: string, re: RegExp): boolean {
  return text.split('\n').some((line) => {
    re.lastIndex = 0;
    return re.test(line);
  });
}

export function replaceLines(text: string, re: RegExp, replacement: string): { text: string; count: number } {
  let count = 0;
  const lines = text.split('\n').map((line) =>
    line.replace(re, (...args: unknown[]) => {
      count++;
      return expandOne(replacement, args);
    }),
  );
  return { text: lines.join('\n'), count };
}

/** Expand `$1`, `$<name>`, `$&`, `$$` for one match (the callback form of
 *  `replace` does not expand them itself). */
function expandOne(replacement: string, args: unknown[]): string {
  const hasGroups = typeof args[args.length - 1] === 'object';
  const groups = (hasGroups ? args[args.length - 1] : undefined) as Record<string, string> | undefined;
  const captureEnd = args.length - (hasGroups ? 3 : 2);
  const captures = args.slice(0, captureEnd) as Array<string | undefined>;
  return replacement.replace(/\$(\$|&|\d{1,2}|<([^>]*)>)/g, (token, what: string, name?: string) => {
    if (what === '$') return '$';
    if (what === '&') return captures[0] ?? '';
    if (name !== undefined) return groups?.[name] ?? '';
    const idx = Number(what);
    return idx < captures.length ? captures[idx] ?? '' : token;
  });
}
