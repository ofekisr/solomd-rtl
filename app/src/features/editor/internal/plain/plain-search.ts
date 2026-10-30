export function findPlainMatches(
  text: string,
  query: string,
  caseSensitive: boolean,
): Array<{ start: number; end: number }> {
  if (!query) return [];
  const hay = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const out: Array<{ start: number; end: number }> = [];
  let i = hay.indexOf(needle);
  while (i >= 0) {
    out.push({ start: i, end: i + query.length });
    i = hay.indexOf(needle, i + Math.max(1, query.length));
  }
  return out;
}
