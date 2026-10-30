import type { MindElixirData, NodeObj } from 'mind-elixir';
import { scanMarkdown, type MdBlock } from './md-scan.ts';

export interface ConvertOptions { rootTopic: string; path?: string; firstLine?: number }
export interface LineRange { fromLine: number; toLine: number }

export const SELECTION_ROOT_TOPIC = 'Selection';
const ROOT_ID = 'root';
const ID_PREFIX = 'n';
const SAME_PARAGRAPH = ' ';
const NEW_PARAGRAPH = '\n\n';
const NEWLINE = '\n';
const ROOT_LEVEL = 0;
const ROOT_FRAME_COUNT = 1;

type HeadingFrame = { level: number; node: NodeObj };
type ItemFrame = { indent: number; node: NodeObj };

class TreeBuilder {
  private count = 0;
  private headings: HeadingFrame[];
  private items: ItemFrame[] = [];
  private previous: MdBlock | null = null;
  private lastNoteNode: NodeObj | null = null;
  readonly root: NodeObj;
  private readonly fromHeading = new WeakSet<NodeObj>();

  private readonly options: ConvertOptions;

  constructor(options: ConvertOptions) {
    this.options = options;
    this.root = { id: ROOT_ID, topic: options.rootTopic, children: [] };
    this.headings = [{ level: ROOT_LEVEL, node: this.root }];
  }

  add(block: MdBlock): void {
    if (block.kind === 'heading') this.addHeading(block.level, block.text, block.line);
    else if (block.kind === 'item') this.addItem(block.indent, block.text, block.line);
    else if (block.kind === 'text') this.addText(block.indent, block.text);
    this.previous = block;
  }

  isHeadingNode(node: NodeObj): boolean {
    return this.fromHeading.has(node);
  }

  private node(topic: string, line: number): NodeObj {
    this.count += 1;
    const source = this.options.path === undefined ? { line } : { line, path: this.options.path };
    return { id: `${ID_PREFIX}${this.count}`, topic, children: [], metadata: { source } };
  }

  private addHeading(level: number, text: string, line: number): void {
    while (this.headings.length > ROOT_FRAME_COUNT && this.headings[this.headings.length - 1].level >= level) this.headings.pop();
    const node = this.node(text, line);
    this.fromHeading.add(node);
    this.headingTop().children?.push(node);
    this.headings.push({ level, node });
    this.items = [];
  }

  private addItem(indent: number, text: string, line: number): void {
    while (this.items.length > 0 && this.items[this.items.length - 1].indent >= indent) this.items.pop();
    const parent = this.items.length > 0 ? this.items[this.items.length - 1].node : this.headingTop();
    const node = this.node(text, line);
    parent.children?.push(node);
    this.items.push({ indent, node });
  }

  private addText(indent: number, text: string): void {
    const canContinue = this.items.length > 0 && (indent > 0 || this.previous?.kind !== 'blank');
    if (canContinue && indent > 0) this.closeItemsFrom(indent);
    const target = this.items.length > 0 && canContinue ? this.items[this.items.length - 1].node : this.headingTop();
    if (target === this.headingTop()) this.items = [];
    this.appendNote(target, text);
  }

  private closeItemsFrom(indent: number): void {
    while (this.items.length > 0 && this.items[this.items.length - 1].indent >= indent) this.items.pop();
  }

  private appendNote(node: NodeObj, text: string): void {
    const sameParagraph = this.previous?.kind === 'text' && this.lastNoteNode === node;
    const joiner = sameParagraph ? SAME_PARAGRAPH : NEW_PARAGRAPH;
    node.note = node.note ? `${node.note}${joiner}${text}` : text;
    this.lastNoteNode = node;
  }

  private headingTop(): NodeObj {
    return this.headings[this.headings.length - 1].node;
  }
}

function liftSoleHeading(builder: TreeBuilder): NodeObj {
  const { root } = builder;
  const children = root.children ?? [];
  if (children.length !== 1 || root.note || !builder.isHeadingNode(children[0])) return root;
  return { ...children[0], id: ROOT_ID };
}

export function markdownToMindmap(source: string, options: ConvertOptions): MindElixirData {
  const builder = new TreeBuilder(options);
  for (const block of scanMarkdown(source, options.firstLine)) builder.add(block);
  return { nodeData: liftSoleHeading(builder) };
}

export function sectionRange(source: string, line: number): LineRange | null {
  const headings = scanMarkdown(source).filter((b): b is Extract<MdBlock, { kind: 'heading' }> => b.kind === 'heading');
  const start = headings.filter((h) => h.line <= line).pop();
  if (!start) return null;
  const next = headings.find((h) => h.line > start.line && h.level <= start.level);
  const lastLine = source.split(NEWLINE).length;
  return { fromLine: start.line, toLine: next ? next.line - 1 : lastLine };
}

export function sliceLines(source: string, range: LineRange): string {
  return source.split(NEWLINE).slice(range.fromLine - 1, range.toLine).join(NEWLINE);
}
