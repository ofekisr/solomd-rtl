import yaml from 'js-yaml';
import { escapeHtml } from './markdown-text.ts';

// Per-render front-matter capture. markdown-it is synchronous so a
// module-level variable is safe for sequential calls, but this is NOT
// concurrent-safe across interleaved renders.
let lastFrontMatterRaw: string | null = null;

export function getFrontMatterRaw(): string | null {
  return lastFrontMatterRaw;
}

export function setFrontMatterRaw(raw: string | null): void {
  lastFrontMatterRaw = raw;
}

export function renderFrontMatterHtml(raw: string): string {
  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch {
    return `<pre class="md-frontmatter md-frontmatter--raw">${escapeHtml(
      raw,
    )}</pre>`;
  }
  if (
    parsed === null ||
    parsed === undefined ||
    typeof parsed !== 'object' ||
    Array.isArray(parsed)
  ) {
    // Not a key/value map — fall back to raw display.
    return `<pre class="md-frontmatter md-frontmatter--raw">${escapeHtml(
      raw,
    )}</pre>`;
  }
  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) {
    return `<pre class="md-frontmatter md-frontmatter--raw">${escapeHtml(
      raw,
    )}</pre>`;
  }
  const rows = entries
    .map(([k, v]) => {
      const valueText =
        v === null || v === undefined
          ? ''
          : typeof v === 'object'
            ? JSON.stringify(v)
            : String(v);
      return `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(valueText)}</dd>`;
    })
    .join('');
  return `<div class="md-frontmatter"><dl>${rows}</dl></div>`;
}
