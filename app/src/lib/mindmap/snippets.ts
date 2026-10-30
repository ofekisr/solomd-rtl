export type SnippetKind = 'md' | 'mermaid' | 'mmap';
export interface Snippet { id: string; kind: SnippetKind; title: string; body: string }

export const SNIPPET_KINDS: readonly SnippetKind[] = ['md', 'mermaid', 'mmap'];
const ID_PREFIX = 's';
const ID_PATTERN = /^[\w-]+$/u;
const NUMBERED_ID_PATTERN = /^s(\d+)$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSnippetKind(value: unknown): value is SnippetKind {
  return typeof value === 'string' && (SNIPPET_KINDS as readonly string[]).includes(value);
}

function toSnippet(value: unknown): Snippet | null {
  if (!isRecord(value) || !isSnippetKind(value.kind)) return null;
  const { id, title, body } = value;
  if (typeof id !== 'string' || typeof title !== 'string' || typeof body !== 'string') return null;
  return { id, kind: value.kind, title, body };
}

export function nextSnippetId(existing: readonly Snippet[]): string {
  const numbers = existing.map((s) => NUMBERED_ID_PATTERN.exec(s.id)?.[1]).filter((n): n is string => n !== undefined).map(Number);
  return `${ID_PREFIX}${Math.max(0, ...numbers) + 1}`;
}

function withUniqueIds(snippets: Snippet[]): Snippet[] {
  const out: Snippet[] = [];
  for (const snippet of snippets) {
    const isTaken = !ID_PATTERN.test(snippet.id) || out.some((s) => s.id === snippet.id);
    out.push(isTaken ? { ...snippet, id: nextSnippetId([...out, ...snippets]) } : snippet);
  }
  return out;
}

export function sanitizeSnippets(value: unknown): Snippet[] {
  if (!Array.isArray(value)) return [];
  return withUniqueIds(value.map(toSnippet).filter((s): s is Snippet => s !== null));
}

export function createSnippet(kind: SnippetKind, existing: readonly Snippet[], title: string): Snippet {
  return { id: nextSnippetId(existing), kind, title, body: '' };
}

export type SnippetMarkdownMode = 'source' | 'rendered';

const SECTION_HEADING = '## Snippets';
const TITLE_MARK = '### ';
const MIN_FENCE = 3;
const BACKTICK = '`';
const BACKTICK_RUN = /`+/g;
const FENCE_LANG: Record<SnippetKind, string> = { md: 'markdown', mermaid: 'mermaid', mmap: 'mindmap' };
const BLOCK_SEPARATOR = '\n\n';

function fenceOf(body: string, lang: string): string {
  const longest = Math.max(0, ...(body.match(BACKTICK_RUN) ?? []).map((run) => run.length));
  const fence = BACKTICK.repeat(Math.max(MIN_FENCE, longest + 1));
  return `${fence}${lang}\n${body}\n${fence}`;
}

function bodyBlock(snippet: Snippet, mode: SnippetMarkdownMode): string {
  if (snippet.kind === 'md' && mode === 'rendered') return snippet.body;
  return fenceOf(snippet.body, FENCE_LANG[snippet.kind]);
}

function titleOf(snippet: Snippet): string {
  return snippet.title.trim() || snippet.id;
}

export function snippetPreviewSource(snippet: Snippet): string {
  return bodyBlock(snippet, 'rendered');
}

export function snippetsMarkdown(snippets: readonly Snippet[], mode: SnippetMarkdownMode): string {
  if (snippets.length === 0) return '';
  const blocks = snippets.map((s) => `${TITLE_MARK}${titleOf(s)}${BLOCK_SEPARATOR}${bodyBlock(s, mode)}`);
  return `${[SECTION_HEADING, ...blocks].join(BLOCK_SEPARATOR)}\n`;
}
