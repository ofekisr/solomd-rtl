const STORAGE_KEY = 'solomd.recentFenceLanguages';
export const MAX_RECENT_FENCE_LANGUAGES = 3;

export function pushRecent(recents: readonly string[], name: string, max = MAX_RECENT_FENCE_LANGUAGES): string[] {
  const clean = name.trim().toLowerCase();
  if (!clean) return [...recents];
  return [clean, ...recents.filter((r) => r !== clean)].slice(0, max);
}

export function getRecentFenceLanguages(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT_FENCE_LANGUAGES) : [];
  } catch {
    return [];
  }
}

export function recordFenceLanguage(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pushRecent(getRecentFenceLanguages(), name)));
  } catch {
    /* storage unavailable: recents are a convenience only */
  }
}
