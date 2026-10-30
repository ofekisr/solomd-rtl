import { reactive } from 'vue';
import type { Filter } from '../lib/bases';
import { isEmptyFilterValue, tagsOfFilter, toDateInputValue, upsertFilter } from './basesFilterValues.ts';

type RangeOp = '>' | '<';

export function useBasesFilters() {
  const filters = reactive<Filter[]>([]);

  function getFilterFor(columnId: string): Filter | null {
    return filters.find((f) => f.column === columnId) ?? null;
  }

  function setFilter(columnId: string, op: Filter['op'], value: unknown): void {
    const i = filters.findIndex((f) => f.column === columnId);
    if (isEmptyFilterValue(value)) {
      if (i >= 0) filters.splice(i, 1);
      return;
    }
    upsertFilter(filters, i, { column: columnId, op, value });
  }

  function clearFilters(): void {
    filters.splice(0, filters.length);
  }

  function dateRange(columnId: string, op: RangeOp): string {
    const f = filters.find((x) => x.column === columnId && x.op === op);
    return f ? toDateInputValue(f.value) : '';
  }

  function setDateRange(columnId: string, op: RangeOp, value: string): void {
    const i = filters.findIndex((x) => x.column === columnId && x.op === op);
    if (!value) {
      if (i >= 0) filters.splice(i, 1);
      return;
    }
    const ms = new Date(value).getTime();
    if (isNaN(ms)) return;
    upsertFilter(filters, i, { column: columnId, op, value: ms });
  }

  function selectedTagsFor(columnId: string): string[] {
    return tagsOfFilter(filters.find((x) => x.column === columnId && x.op === 'has-tag'));
  }

  function toggleTagFilter(columnId: string, tag: string): void {
    const cur = selectedTagsFor(columnId);
    const next = cur.includes(tag) ? cur.filter((x) => x !== tag) : [...cur, tag];
    setFilter(columnId, 'has-tag', next);
  }

  return {
    filters, getFilterFor, setFilter, clearFilters, selectedTagsFor, toggleTagFilter,
    getDateRangeStart: (columnId: string) => dateRange(columnId, '>'),
    getDateRangeEnd: (columnId: string) => dateRange(columnId, '<'),
    setDateRangeStart: (columnId: string, value: string) => setDateRange(columnId, '>', value),
    setDateRangeEnd: (columnId: string, value: string) => setDateRange(columnId, '<', value),
  };
}
