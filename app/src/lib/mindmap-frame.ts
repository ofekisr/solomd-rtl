import { MINDMAP_LAYOUT } from './mindmap-direction.ts';

export const FRAME_PADDING_PX = 64;

export interface FrameRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface FrameInput {
  readonly container: FrameRect;
  readonly content: FrameRect;
  readonly root: FrameRect;
  readonly layout: number;
  readonly padding?: number;
}

export interface FrameDelta {
  readonly dx: number;
  readonly dy: number;
}

export interface PanInput {
  readonly container: FrameRect;
  readonly content: FrameRect;
  readonly dx: number;
  readonly dy: number;
  readonly keepVisible?: number;
}

export interface Translate {
  readonly x: number;
  readonly y: number;
}

const TRANSLATE_PATTERN = /translate3d\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px/u;

function centerX(rect: FrameRect): number {
  return rect.left + rect.width / 2;
}

function centerY(rect: FrameRect): number {
  return rect.top + rect.height / 2;
}

function overflowDx({ container, content, root, layout }: FrameInput, padding: number): number {
  if (layout === MINDMAP_LAYOUT.RIGHT) return container.left + padding - content.left;
  if (layout === MINDMAP_LAYOUT.LEFT) return container.left + container.width - padding - (content.left + content.width);
  return centerX(container) - centerX(root);
}

function overflowDy({ container, content, root, layout }: FrameInput, padding: number): number {
  if (layout === MINDMAP_LAYOUT.DOWN) return container.top + padding - content.top;
  return centerY(container) - centerY(root);
}

export function frameDelta(input: FrameInput): FrameDelta {
  const padding = input.padding ?? FRAME_PADDING_PX;
  const { container, content } = input;
  const fitsX = content.width + 2 * padding <= container.width;
  const fitsY = content.height + 2 * padding <= container.height;
  return {
    dx: fitsX ? centerX(container) - centerX(content) : overflowDx(input, padding),
    dy: fitsY ? centerY(container) - centerY(content) : overflowDy(input, padding),
  };
}

function clampAxis(delta: number, viewStart: number, viewEnd: number, contentStart: number, contentEnd: number, keep: number): number {
  if (delta > 0) return Math.min(delta, Math.max(0, viewEnd - keep - contentStart));
  if (delta < 0) return Math.max(delta, Math.min(0, viewStart + keep - contentEnd));
  return 0;
}

export function panDelta({ container, content, dx, dy, keepVisible = FRAME_PADDING_PX }: PanInput): FrameDelta {
  return {
    dx: clampAxis(dx, container.left, container.left + container.width, content.left, content.left + content.width, keepVisible),
    dy: clampAxis(dy, container.top, container.top + container.height, content.top, content.top + content.height, keepVisible),
  };
}

export function insetRect(rect: FrameRect, inlineInset: number, blockInset: number): FrameRect {
  return {
    left: rect.left + inlineInset,
    top: rect.top + blockInset,
    width: Math.max(0, rect.width - 2 * inlineInset),
    height: Math.max(0, rect.height - 2 * blockInset),
  };
}

export function parseTranslate(transform: string): Translate {
  const match = TRANSLATE_PATTERN.exec(transform);
  return match ? { x: Number(match[1]), y: Number(match[2]) } : { x: 0, y: 0 };
}
