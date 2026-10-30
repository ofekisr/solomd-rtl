import type { MindElixirData, NodeObj } from 'mind-elixir';

const MAX_HEADING_LEVEL = 6;
const ROOT_DEPTH = 0;
const HEADING_MARK = '#';
const BULLET_MARK = '- ';
const BULLET_INDENT = '  ';
const SPACE = ' ';
const NEWLINE = '\n';
const BLANK_LINE = '\n';
const LINE_BREAKS = /\s*\r?\n\s*/g;

type Block = { kind: 'heading' | 'bullet'; text: string };

function flatten(topic: string): string {
  return topic.replace(LINE_BREAKS, SPACE).trim();
}

function headingBlock(text: string, level: number): Block {
  return { kind: 'heading', text: `${HEADING_MARK.repeat(level)}${SPACE}${text}` };
}

function bulletBlock(text: string, level: number): Block {
  const indent = BULLET_INDENT.repeat(level - MAX_HEADING_LEVEL - 1);
  return { kind: 'bullet', text: `${indent}${BULLET_MARK}${text}` };
}

function blockFor(node: NodeObj, depth: number): Block {
  const level = depth + 1;
  const text = flatten(node.topic);
  if (level <= MAX_HEADING_LEVEL) return headingBlock(text, level);
  return bulletBlock(text, level);
}

function collect(node: NodeObj, depth: number, out: Block[]): void {
  out.push(blockFor(node, depth));
  for (const child of node.children ?? []) collect(child, depth + 1, out);
}

function separate(blocks: Block[]): string[] {
  return blocks.map((block, index) => {
    if (index === 0) return block.text;
    const previous = blocks[index - 1];
    const needsBlankLine = block.kind === 'heading' || previous.kind === 'heading';
    return needsBlankLine ? `${BLANK_LINE}${block.text}` : block.text;
  });
}

export function mapToHeadingsMarkdown(data: MindElixirData): string {
  const blocks: Block[] = [];
  collect(data.nodeData, ROOT_DEPTH, blocks);
  return `${separate(blocks).join(NEWLINE)}${NEWLINE}`;
}
