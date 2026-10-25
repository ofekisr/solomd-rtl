import { reactive } from 'vue';

export const AI_ACTIVITY_EVENT = 'solomd://ai-activity';
export const AI_ACTIVITY_STALE_MS = 15_000;

export interface AiActivityEvent { path: string; active: boolean }

const busy = reactive(new Set<string>());
const dismissed = reactive(new Set<string>());
const staleTimers = new Map<string, ReturnType<typeof setTimeout>>();

function clearStale(path: string): void {
  const timer = staleTimers.get(path);
  if (timer !== undefined) clearTimeout(timer);
  staleTimers.delete(path);
}

export function applyAiActivity(event: AiActivityEvent): void {
  clearStale(event.path);
  if (!event.active) {
    busy.delete(event.path);
    dismissed.delete(event.path);
    return;
  }
  busy.add(event.path);
  staleTimers.set(event.path, setTimeout(() => applyAiActivity({ path: event.path, active: false }), AI_ACTIVITY_STALE_MS));
}

export function isAiWorking(path: string | null | undefined): boolean {
  return path ? busy.has(path) : false;
}

export function dismissAiWarning(path: string | null | undefined): void {
  if (path && busy.has(path)) dismissed.add(path);
}

export function isAiWarningVisible(path: string | null | undefined): boolean {
  return isAiWorking(path) && !dismissed.has(path as string);
}
