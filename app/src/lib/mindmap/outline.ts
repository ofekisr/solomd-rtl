import type { MindmapCodec } from './format.ts';
import { mapToHeadingsMarkdown } from './headings.ts';
import { withoutGateArrows } from './graph.ts';
import { snippetsMarkdown, type SnippetMarkdownMode } from './snippets.ts';

export type ParsedMap = ReturnType<MindmapCodec['parse']>;

const LINE_BREAK = '\n';
const SECTION_GAP = '\n';

export function outlineMarkdownOf(parsed: ParsedMap, mode: SnippetMarkdownMode = 'source'): string {
  if (!parsed.ok) return '';
  const map = mapToHeadingsMarkdown(withoutGateArrows(parsed.data));
  const snippets = snippetsMarkdown(parsed.snippets, mode);
  return snippets === '' ? map : `${map}${SECTION_GAP}${snippets}`;
}

export function outlineLines(markdown: string): string[] {
  return markdown.split(LINE_BREAK);
}
