import type { ViewMode } from '../types.ts';

export type ViewModeGuard = (next: ViewMode) => boolean;

const guards = new Set<ViewModeGuard>();

export function addViewModeGuard(guard: ViewModeGuard): () => void {
  guards.add(guard);
  return () => { guards.delete(guard); };
}

export function isViewModeChangeAllowed(next: ViewMode): boolean {
  for (const guard of guards) {
    if (!guard(next)) return false;
  }
  return true;
}
