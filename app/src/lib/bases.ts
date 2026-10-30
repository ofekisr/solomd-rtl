/**
 * Bases-style YAML properties table (v2.0 F6).
 *
 * Pure data utilities over the workspace index. No Tauri / DOM access — these
 * helpers feed `BasesView.vue`. The single source of truth is the
 * `useWorkspaceIndexStore` `entries: IndexEntry[]` array; we infer columns
 * from front-matter, format cell values, filter, and sort.
 *
 * Built-in columns (always present):
 *   - `name`  : file name
 *   - `mtime` : modified time (formatted YYYY-MM-DD HH:mm)
 *   - `tags`  : comma-joined tags
 *
 * User columns are auto-discovered: any front-matter key that appears in 2+
 * entries becomes a column. Type is inferred from the values.
 */
export * from './bases-types.ts';
export * from './bases-columns.ts';
export {
  applyFilterGroup,
  applyFilters,
  matchesGroup,
  normalizeFilterGroup,
} from './bases-filter.ts';
export { parseRelativeDuration } from './bases-values.ts';
export { applySort } from './bases-sort.ts';
export * from './bases-views.ts';
