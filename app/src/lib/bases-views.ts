import type { SavedView } from './bases-types.ts';

// ---------- saved views ----------

export const SAVED_VIEWS_KEY = 'solomd.basesViews.v1';

export function loadSavedViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return defaultViews();
    const parsed = JSON.parse(raw) as SavedView[];
    if (!Array.isArray(parsed)) return defaultViews();
    return parsed;
  } catch {
    return defaultViews();
  }
}

export function persistSavedViews(views: SavedView[]): void {
  try {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
  } catch {
    /* localStorage full / disabled — silent */
  }
}

/**
 * The bundled defaults. "Tagged #project" is intentionally omitted unless
 * the workspace already uses that tag (it would otherwise always be empty
 * and confusing on first use). Callers that want the optional view should
 * conditionally extend this list.
 */
export function defaultViews(): SavedView[] {
  const sevenDaysAgoMs = Date.now() - 7 * 24 * 3600 * 1000;
  return [
    {
      name: 'All notes',
      columns: [],
      filters: [],
      sort: { column: 'mtime', dir: 'desc' },
    },
    {
      name: 'Modified this week',
      columns: [],
      filters: [{ column: 'mtime', op: '>', value: sevenDaysAgoMs }],
      sort: { column: 'mtime', dir: 'desc' },
    },
    // "Tagged #project" — uncomment / extend programmatically when the
    // workspace contains a `project` tag:
    // {
    //   name: 'Tagged #project',
    //   columns: [],
    //   filters: [{ column: 'tags', op: 'has-tag', value: 'project' }],
    //   sort: { column: 'mtime', dir: 'desc' },
    // },
  ];
}
