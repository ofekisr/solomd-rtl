/**
 * "Open this map at node X" — used by folder-search hits inside `.mmap` files.
 * The map tab may not be mounted yet when the request is made, so the request
 * is parked per path and claimed by `MindmapView` once its canvas is ready.
 */
export const MINDMAP_REVEAL_EVENT = 'solomd:mindmap-reveal';

const pending = new Map<string, string>();

export function requestMindmapReveal(path: string, nodeId: string): void {
  pending.set(path, nodeId);
  window.dispatchEvent(new CustomEvent(MINDMAP_REVEAL_EVENT, { detail: { path } }));
}

export function claimMindmapReveal(path: string | undefined): string | null {
  if (!path) return null;
  const id = pending.get(path) ?? null;
  pending.delete(path);
  return id;
}
