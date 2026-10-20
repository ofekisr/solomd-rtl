/**
 * Compact, quota-aware storage for the per-workspace tab buckets.
 *
 * WebKit caps an origin's localStorage at 5 MB. Every bucket stores full tab
 * text, so a few big workspaces fill it and every later `setItem` throws —
 * the tab list then silently stops saving and a relaunch shows an old set.
 */
import type { Tab } from '../types';

export interface KeyValueStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface EvictionPolicy {
  bucketPrefix: string;
  sessionPrefix: string;
  /** Bucket keys of recently used workspaces, most recent first. */
  recentBucketKeys: string[];
  /** Tab ids whose editor-session backups must survive. */
  liveTabIds: Set<string>;
}

type StoredTab = Omit<Tab, 'savedContent'> & { savedContent?: string };

/** A clean tab's saved text equals its content; store it once. */
export function compactTabs(tabs: Tab[]): StoredTab[] {
  return tabs.map((t) => {
    if (t.content !== t.savedContent) return t;
    const { savedContent: _same, ...rest } = t;
    return rest;
  });
}

export function expandTabs(tabs: StoredTab[]): Tab[] {
  return tabs.map((t) => (typeof t.savedContent === 'string' ? (t as Tab) : { ...t, savedContent: t.content }));
}

function allKeys(storage: KeyValueStorage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null) keys.push(k);
  }
  return keys;
}

/** Least valuable first: orphan editor backups, then other workspaces'
 *  buckets — never-recent ones before recent ones, oldest recent first. */
export function evictionCandidates(keys: string[], keepKey: string, policy: EvictionPolicy): string[] {
  const sessionId = (k: string): string => k.slice(policy.sessionPrefix.length);
  const sessions = keys.filter((k) => k.startsWith(policy.sessionPrefix) && !policy.liveTabIds.has(sessionId(k)));
  const buckets = keys.filter((k) => k.startsWith(policy.bucketPrefix) && k !== keepKey);
  const recency = (k: string): number => {
    const i = policy.recentBucketKeys.indexOf(k);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  buckets.sort((a, b) => recency(b) - recency(a));
  return [...sessions, ...buckets];
}

function trySet(storage: KeyValueStorage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/** Writes `value`, evicting stale entries one at a time until it fits. */
export function setItemWithEviction(
  storage: KeyValueStorage,
  key: string,
  value: string,
  policy: EvictionPolicy,
): boolean {
  if (trySet(storage, key, value)) return true;
  for (const victim of evictionCandidates(allKeys(storage), key, policy)) {
    storage.removeItem(victim);
    console.warn(`[tabs] localStorage full — evicted ${victim}`);
    if (trySet(storage, key, value)) return true;
  }
  console.error(`[tabs] could not save ${key}: localStorage full`);
  return false;
}
