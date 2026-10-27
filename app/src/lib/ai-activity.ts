import { reactive } from 'vue';

export const AI_ACTIVITY_EVENT = 'solomd://ai-activity';
export const DEFAULT_AI_RELEASE_DELAY_MS = 2_000;
export const DEFAULT_AI_STALE_MS = 60_000;

export interface AiActivityEvent { path: string; holder?: string; active: boolean; ageMs?: number }
export interface AiActivityTiming { releaseDelayMs: number; staleMs: number }

type Timer = ReturnType<typeof setTimeout>;

export const AI_DELAY_LIMITS: Record<keyof AiActivityTiming, { min: number; max: number; fallback: number }> = {
  releaseDelayMs: { min: 0, max: 60_000, fallback: DEFAULT_AI_RELEASE_DELAY_MS },
  staleMs: { min: 5_000, max: 600_000, fallback: DEFAULT_AI_STALE_MS },
};

export function clampAiDelay(value: unknown, key: keyof AiActivityTiming): number {
  const { min, max, fallback } = AI_DELAY_LIMITS[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

const timing: AiActivityTiming = { releaseDelayMs: DEFAULT_AI_RELEASE_DELAY_MS, staleMs: DEFAULT_AI_STALE_MS };
const holders = new Map<string, Map<string, Timer>>();
const releaseTimers = new Map<string, Timer>();
const busy = reactive(new Set<string>());
const minimizedNow = reactive(new Set<string>());
const expandedNow = reactive(new Set<string>());
const minimizedTabs = reactive(new Set<string>());

export function configureAiActivity(next: Partial<AiActivityTiming>): void {
  Object.assign(timing, next);
}

function cancelRelease(path: string): void {
  clearTimeout(releaseTimers.get(path));
  releaseTimers.delete(path);
}

function release(path: string): void {
  releaseTimers.delete(path);
  busy.delete(path);
  minimizedNow.delete(path);
  expandedNow.delete(path);
}

function scheduleRelease(path: string): void {
  cancelRelease(path);
  if (timing.releaseDelayMs <= 0) return release(path);
  releaseTimers.set(path, setTimeout(() => release(path), timing.releaseDelayMs));
}

function holdersOf(path: string): Map<string, Timer> {
  const existing = holders.get(path);
  if (existing) return existing;
  const created = new Map<string, Timer>();
  holders.set(path, created);
  return created;
}

function leave(path: string, holder: string): void {
  const held = holders.get(path);
  if (!held?.has(holder)) return;
  clearTimeout(held.get(holder));
  held.delete(holder);
  if (held.size > 0) return;
  holders.delete(path);
  scheduleRelease(path);
}

function enter(path: string, holder: string, ageMs: number): void {
  const staleInMs = timing.staleMs - ageMs;
  if (staleInMs <= 0) return leave(path, holder);
  const held = holdersOf(path);
  clearTimeout(held.get(holder));
  held.set(holder, setTimeout(() => leave(path, holder), staleInMs));
  cancelRelease(path);
  busy.add(path);
}

export function applyAiActivity(event: AiActivityEvent): void {
  const holder = event.holder ?? '';
  if (event.active) enter(event.path, holder, event.ageMs ?? 0);
  else leave(event.path, holder);
}

export function isAiWorking(path: string | null | undefined): boolean {
  return path ? busy.has(path) : false;
}

export interface AiWarningScope { path: string | null | undefined; tabId: string; alwaysMinimized: boolean }

export function isAiWarningMinimized(scope: AiWarningScope): boolean {
  const path = scope.path ?? '';
  if (expandedNow.has(path)) return false;
  return minimizedNow.has(path) || minimizedTabs.has(scope.tabId) || scope.alwaysMinimized;
}

export function minimizeAiWarning(path: string | null | undefined): void {
  if (!path) return;
  expandedNow.delete(path);
  minimizedNow.add(path);
}

export function keepAiWarningMinimizedForTab(path: string | null | undefined, tabId: string): void {
  minimizedTabs.add(tabId);
  minimizeAiWarning(path);
}

export function forgetAiWarningTab(tabId: string): void {
  minimizedTabs.delete(tabId);
}

export function expandAiWarning(path: string | null | undefined, tabId: string): void {
  if (!path) return;
  minimizedTabs.delete(tabId);
  minimizedNow.delete(path);
  expandedNow.add(path);
}
