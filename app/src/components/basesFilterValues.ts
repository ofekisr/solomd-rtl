import type { Filter } from '../lib/bases';

const PAD_WIDTH = 2;

export function toDateInputValue(raw: unknown): string {
  if (!raw) return '';
  const d = new Date(typeof raw === 'number' ? raw : String(raw));
  if (isNaN(d.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(PAD_WIDTH, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isEmptyFilterValue(value: unknown): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

export function upsertFilter(filters: Filter[], index: number, next: Filter): void {
  if (index >= 0) filters.splice(index, 1, next);
  else filters.push(next);
}

export function tagsOfFilter(filter: Filter | undefined): string[] {
  if (!filter) return [];
  return Array.isArray(filter.value) ? (filter.value as string[]) : [String(filter.value)];
}
