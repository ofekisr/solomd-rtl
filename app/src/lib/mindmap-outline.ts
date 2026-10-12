import type { MindmapCodec } from './mindmap-format.ts';
import { mapToHeadingsMarkdown } from './mindmap-headings.ts';
import { withoutGateArrows } from './mindmap-graph.ts';

export type ParsedMap = ReturnType<MindmapCodec['parse']>;

const LINE_BREAK = '\n';

export function outlineMarkdownOf(parsed: ParsedMap): string {
  return parsed.ok ? mapToHeadingsMarkdown(withoutGateArrows(parsed.data)) : '';
}

export function outlineLines(markdown: string): string[] {
  return markdown.split(LINE_BREAK);
}
