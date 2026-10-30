export interface MathBlock { from: number; to: number; latex: string }

/**
 * Locate the `$$…$$` block whose opening `$$` is at/near 1-indexed `startLine`
 * and return its 0-indexed inclusive line range plus the inner LaTeX.
 */
export function findMathBlock(
  source: string,
  startLine: number,
): MathBlock | null {
  const lines = source.split('\n');
  let openIdx = -1;
  for (let k = startLine - 1; k >= 0 && k < Math.min(lines.length, startLine + 1); k++) {
    if (k >= 0 && lines[k]?.includes('$$')) { openIdx = k; break; }
  }
  if (openIdx === -1) return null;
  const openLine = lines[openIdx];
  const openPos = openLine.indexOf('$$');
  const afterOpen = openLine.slice(openPos + 2);
  // Single-line: $$ latex $$
  const sameClose = afterOpen.indexOf('$$');
  if (sameClose !== -1) {
    return { from: openIdx, to: openIdx, latex: afterOpen.slice(0, sameClose).trim() };
  }
  // Multi-line: find the closing $$
  let closeIdx = -1;
  for (let k = openIdx + 1; k < lines.length; k++) {
    if (lines[k].includes('$$')) { closeIdx = k; break; }
  }
  if (closeIdx === -1) return null;
  const closeLine = lines[closeIdx];
  const tail = closeLine.slice(0, closeLine.indexOf('$$'));
  const latex = [afterOpen, ...lines.slice(openIdx + 1, closeIdx), tail]
    .join('\n')
    .replace(/^\s*\n|\n\s*$/g, '')
    .trim();
  return { from: openIdx, to: closeIdx, latex };
}
