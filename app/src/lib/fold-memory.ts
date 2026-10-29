/**
 * Remembers an editor's folds per document across tab switches and remounts.
 *
 * A snapshot keeps the exact ranges (re-applied as-is when the text is
 * unchanged) and heading anchors (re-matched by title when it changed, since
 * offsets no longer mean anything then).
 */
import { anchorAtLine, foldRangeAtLine, remapFolds, type FoldAnchor, type FoldRange } from './heading-fold.ts';

export interface FoldSnapshot {
  text: string;
  ranges: FoldRange[];
  anchors: FoldAnchor[];
}

const MAX_REMEMBERED = 200;
const memory = new Map<string, FoldSnapshot>();

function lineOfOffset(text: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') line++;
  return line;
}

export function captureFolds(text: string, ranges: readonly FoldRange[]): FoldSnapshot {
  const anchors = ranges
    .map((r) => anchorAtLine(text, lineOfOffset(text, r.from)))
    .filter((a): a is FoldAnchor => a !== null);
  return { text, ranges: ranges.map((r) => ({ ...r })), anchors };
}

export function anchorSnapshot(text: string, anchors: readonly FoldAnchor[]): FoldSnapshot {
  return { text, ranges: [], anchors: anchors.map((a) => ({ ...a })) };
}

export function foldRangesFor(text: string, snapshot: FoldSnapshot): FoldRange[] {
  if (text === snapshot.text) return snapshot.ranges.filter((r) => r.to <= text.length && r.to > r.from);
  return remapFolds(text, snapshot.anchors)
    .map((a) => foldRangeAtLine(text, a.line))
    .filter((r): r is FoldRange => r !== null);
}

export function foldAnchorsFor(text: string, snapshot: FoldSnapshot): FoldAnchor[] {
  return remapFolds(text, snapshot.anchors);
}

export function rememberFolds(key: string, snapshot: FoldSnapshot): void {
  memory.delete(key);
  if (snapshot.ranges.length === 0 && snapshot.anchors.length === 0) return;
  memory.set(key, snapshot);
  if (memory.size > MAX_REMEMBERED) memory.delete(memory.keys().next().value as string);
}

export function recallFolds(key: string): FoldSnapshot | null {
  return memory.get(key) ?? null;
}
