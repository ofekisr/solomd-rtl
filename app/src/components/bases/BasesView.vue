<script setup lang="ts">
/**
 * Bases-style YAML properties table view (v2.0 F6).
 *
 * Renders every `.md` file in the workspace as a row in a table; each
 * frontmatter key seen 2+ times becomes a column. Filter/sort/save-view
 * state is local to this component (filter row above the table); saved
 * views persist to localStorage via `lib/bases.ts`.
 *
 * Virtual scrolling: the table body windows the rows by a viewport-sized
 * slice plus a 20-row buffer on each side. We compute visible rows from
 * scrollTop/clientHeight and pad with absolutely-zero-height spacer
 * <tr>s so total scroll height stays correct.
 *
 * Hosted by App.vue (parent integration); a "Back to editor" button in the
 * header dispatches `solomd:close-bases` so the parent can swap back.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useBasesFilters } from './useBasesFilters.ts';
import { useWorkspaceIndexStore, type IndexEntry } from '../../stores/workspaceIndex';
import { useFiles } from '../../composables/useFiles';
import { useI18n } from '../../i18n';
import {
  applyFilters,
  applySort,
  defaultViews,
  getCellValue,
  inferColumns,
  loadSavedViews,
  persistSavedViews,
  type ColumnDef,
  type SavedView,
  type SortSpec,
} from '../../lib/bases';
import { BASES_CLOSE_EVENT } from '../../composables/useBasesView';

const idx = useWorkspaceIndexStore();
const files = useFiles();
const { t } = useI18n();

// ---- columns ----
const allColumns = computed<ColumnDef[]>(() => inferColumns(idx.entries));
/** Ids of currently-visible columns. Empty array = "show all". */
const visibleColumnIds = ref<string[]>([]);
const visibleColumns = computed<ColumnDef[]>(() => {
  if (visibleColumnIds.value.length === 0) return allColumns.value;
  const set = new Set(visibleColumnIds.value);
  return allColumns.value.filter((c) => set.has(c.id));
});

// ---- filters / sort / saved views ----
const {
  filters, getFilterFor, setFilter, clearFilters, selectedTagsFor, toggleTagFilter,
  getDateRangeStart, getDateRangeEnd, setDateRangeStart, setDateRangeEnd,
} = useBasesFilters();
const sort = ref<SortSpec | null>({ column: 'mtime', dir: 'desc' });
const savedViews = ref<SavedView[]>([]);
const activeViewName = ref<string>('All notes');

function loadViewIntoState(v: SavedView) {
  activeViewName.value = v.name;
  // Replace filters reactively
  filters.splice(0, filters.length, ...v.filters);
  visibleColumnIds.value = v.columns.slice();
  sort.value = v.sort ? { ...v.sort } : null;
}

function selectView(name: string) {
  const v = savedViews.value.find((x) => x.name === name);
  if (v) loadViewIntoState(v);
}

function newView() {
  const name = prompt(t('bases.newViewPrompt'));
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  // Replace existing view with same name
  const existing = savedViews.value.findIndex((v) => v.name === trimmed);
  const snapshot: SavedView = {
    name: trimmed,
    columns: visibleColumnIds.value.slice(),
    filters: filters.map((f) => ({ ...f })),
    sort: sort.value ? { ...sort.value } : null,
  };
  if (existing >= 0) savedViews.value.splice(existing, 1, snapshot);
  else savedViews.value.push(snapshot);
  persistSavedViews(savedViews.value);
  activeViewName.value = trimmed;
}

function deleteActiveView() {
  const i = savedViews.value.findIndex((v) => v.name === activeViewName.value);
  if (i < 0) return;
  // Don't allow deletion if it's the last one — reseed defaults.
  savedViews.value.splice(i, 1);
  if (savedViews.value.length === 0) savedViews.value = defaultViews();
  persistSavedViews(savedViews.value);
  loadViewIntoState(savedViews.value[0]);
}

/** Tag values present across the workspace, for the multi-select dropdown. */
const tagValues = computed<string[]>(() => {
  const set = new Set<string>();
  for (const e of idx.entries) for (const tag of e.tags) set.add(tag);
  return Array.from(set).sort();
});

/** Per-frontmatter-key array values (for array-column dropdowns). */
function arrayValuesFor(col: ColumnDef): string[] {
  const set = new Set<string>();
  for (const e of idx.entries) {
    if (col.source === 'builtin' && col.id === 'tags') {
      for (const v of e.tags) set.add(v);
    } else if (col.source === 'frontmatter' && col.fmKey && e.frontmatter) {
      const raw = (e.frontmatter as Record<string, unknown>)[col.fmKey];
      if (Array.isArray(raw)) {
        for (const v of raw) set.add(String(v));
      } else if (raw != null) {
        set.add(String(raw));
      }
    }
  }
  return Array.from(set).sort();
}

// ---- sort header click ----
function toggleSort(col: ColumnDef) {
  if (!sort.value || sort.value.column !== col.id) {
    sort.value = { column: col.id, dir: 'asc' };
  } else if (sort.value.dir === 'asc') {
    sort.value = { column: col.id, dir: 'desc' };
  } else {
    sort.value = null;
  }
}
function sortIndicator(col: ColumnDef): string {
  if (!sort.value || sort.value.column !== col.id) return '';
  return sort.value.dir === 'asc' ? ' ▲' : ' ▼';
}

// ---- final rows after filter+sort ----
const processedRows = computed<IndexEntry[]>(() => {
  const filtered = applyFilters(idx.entries, filters, allColumns.value);
  return applySort(filtered, sort.value, allColumns.value);
});

// ---- virtual scroll ----
const ROW_HEIGHT = 32; // px, matches CSS
const BUFFER_ROWS = 20;

const scrollEl = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const viewportHeight = ref(600);

function onScroll(e: Event) {
  scrollTop.value = (e.target as HTMLElement).scrollTop;
}

function recomputeViewport() {
  if (scrollEl.value) {
    viewportHeight.value = scrollEl.value.clientHeight;
  }
}

const visibleSlice = computed(() => {
  const total = processedRows.value.length;
  if (total === 0) return { start: 0, end: 0, padTop: 0, padBottom: 0 };
  const visibleStart = Math.floor(scrollTop.value / ROW_HEIGHT);
  const visibleCount = Math.ceil(viewportHeight.value / ROW_HEIGHT);
  const start = Math.max(0, visibleStart - BUFFER_ROWS);
  const end = Math.min(total, visibleStart + visibleCount + BUFFER_ROWS);
  return {
    start,
    end,
    padTop: start * ROW_HEIGHT,
    padBottom: (total - end) * ROW_HEIGHT,
  };
});

const visibleRows = computed(() =>
  processedRows.value.slice(visibleSlice.value.start, visibleSlice.value.end),
);

// IntersectionObserver as a passive trigger to recompute when the table
// scrolls into view (e.g. after open). Spec asks for it explicitly.
let io: IntersectionObserver | null = null;
function setupObserver() {
  if (!scrollEl.value || typeof IntersectionObserver === 'undefined') return;
  io = new IntersectionObserver(() => {
    recomputeViewport();
  });
  io.observe(scrollEl.value);
}

// ---- column picker ----
const columnPickerOpen = ref(false);
function toggleColumn(id: string) {
  // First click: switch to explicit list (start with all current columns).
  if (visibleColumnIds.value.length === 0) {
    visibleColumnIds.value = allColumns.value.map((c) => c.id);
  }
  const i = visibleColumnIds.value.indexOf(id);
  if (i >= 0) visibleColumnIds.value.splice(i, 1);
  else visibleColumnIds.value.push(id);
}
function isColumnVisible(id: string): boolean {
  if (visibleColumnIds.value.length === 0) return true;
  return visibleColumnIds.value.includes(id);
}

// ---- file open ----
async function openEntry(entry: IndexEntry) {
  await files.openPath(entry.path, { bypassNewWindow: true });
}

function closeBases() {
  window.dispatchEvent(new CustomEvent(BASES_CLOSE_EVENT));
}

// ---- lifecycle ----
let resizeHandler: (() => void) | null = null;

onMounted(() => {
  // Seed saved views.
  savedViews.value = loadSavedViews();
  if (savedViews.value.length === 0) {
    savedViews.value = defaultViews();
    persistSavedViews(savedViews.value);
  }
  // Auto-add the "Tagged #project" default if the workspace happens to use it.
  if (
    tagValues.value.includes('project') &&
    !savedViews.value.some((v) => v.name === 'Tagged #project')
  ) {
    savedViews.value.push({
      name: 'Tagged #project',
      columns: [],
      filters: [{ column: 'tags', op: 'has-tag', value: 'project' }],
      sort: { column: 'mtime', dir: 'desc' },
    });
    persistSavedViews(savedViews.value);
  }
  loadViewIntoState(savedViews.value[0]);

  recomputeViewport();
  setupObserver();
  resizeHandler = () => recomputeViewport();
  window.addEventListener('resize', resizeHandler);
});

onBeforeUnmount(() => {
  if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  if (io) {
    io.disconnect();
    io = null;
  }
});

// Reset scroll on row-set changes so the user isn't stranded mid-list when
// filters narrow results to a small set.
watch(
  () => [processedRows.value.length, activeViewName.value],
  () => {
    if (scrollEl.value) scrollEl.value.scrollTop = 0;
    scrollTop.value = 0;
  },
);

// ---- per-cell text for keyed rendering ----
function cellText(entry: IndexEntry, col: ColumnDef): string {
  return String(getCellValue(entry, col) ?? '');
}

</script>

<template>
  <div class="bases">
    <header class="bases__head">
      <div class="bases__head-left">
        <button
          class="bases__back"
          :title="t('bases.back')"
          @click="closeBases"
        >
          {{ t('bases.back') }}
        </button>
        <strong class="bases__title">{{ t('bases.title') }}</strong>
        <select
          class="bases__view-select"
          :value="activeViewName"
          @change="(e) => selectView((e.target as HTMLSelectElement).value)"
        >
          <option v-for="v in savedViews" :key="v.name" :value="v.name">
            {{ v.name }}
          </option>
        </select>
        <button class="bases__btn" @click="newView">
          {{ t('bases.newView') }}
        </button>
        <button
          class="bases__btn"
          :disabled="savedViews.length <= 1"
          @click="deleteActiveView"
        >
          {{ t('bases.deleteView') }}
        </button>
      </div>
      <div class="bases__head-right">
        <div class="bases__col-picker">
          <button class="bases__btn" @click="columnPickerOpen = !columnPickerOpen">
            {{ t('bases.columns') }}
          </button>
          <div v-if="columnPickerOpen" class="bases__col-menu" @click.stop>
            <label
              v-for="c in allColumns"
              :key="c.id"
              class="bases__col-menu-item"
            >
              <input
                type="checkbox"
                :checked="isColumnVisible(c.id)"
                @change="toggleColumn(c.id)"
              />
              <span>{{ c.label }}</span>
              <span class="bases__kind">{{ c.kind }}</span>
            </label>
          </div>
        </div>
        <button
          v-if="filters.length > 0"
          class="bases__btn"
          @click="clearFilters"
        >
          {{ t('bases.clearFilters') }}
        </button>
        <span class="bases__count">
          {{ t('bases.rowCount', { n: processedRows.length }) }}
        </span>
      </div>
    </header>

    <div v-if="!idx.ready" class="bases__empty">
      {{ t('bases.openFolder') }}
    </div>
    <div v-else-if="idx.entries.length === 0" class="bases__empty">
      {{ t('bases.noEntries') }}
    </div>
    <div v-else class="bases__scroll" ref="scrollEl" @scroll="onScroll">
      <table class="bases__table">
        <thead>
          <tr>
            <th
              v-for="col in visibleColumns"
              :key="col.id"
              class="bases__th"
              :class="`bases__th--${col.kind}`"
              @click="toggleSort(col)"
            >
              {{ col.label }}<span class="bases__sort">{{ sortIndicator(col) }}</span>
            </th>
          </tr>
          <tr class="bases__filter-row">
            <th
              v-for="col in visibleColumns"
              :key="col.id"
              class="bases__filter-cell"
            >
              <!-- Date / mtime: range pickers -->
              <template
                v-if="col.kind === 'date' || (col.source === 'builtin' && col.id === 'mtime')"
              >
                <div class="bases__range">
                  <input
                    type="date"
                    :value="getDateRangeStart(col.id)"
                    :title="t('bases.dateAfter')"
                    @input="(e) => setDateRangeStart(col.id, (e.target as HTMLInputElement).value)"
                  />
                  <input
                    type="date"
                    :value="getDateRangeEnd(col.id)"
                    :title="t('bases.dateBefore')"
                    @input="(e) => setDateRangeEnd(col.id, (e.target as HTMLInputElement).value)"
                  />
                </div>
              </template>

              <!-- Array / tags: multi-select dropdown -->
              <template v-else-if="col.kind === 'array'">
                <details class="bases__multi">
                  <summary>
                    {{ selectedTagsFor(col.id).length === 0
                      ? t('bases.anyValue')
                      : selectedTagsFor(col.id).join(', ') }}
                  </summary>
                  <div class="bases__multi-list">
                    <label
                      v-for="v in arrayValuesFor(col)"
                      :key="v"
                      class="bases__multi-item"
                    >
                      <input
                        type="checkbox"
                        :checked="selectedTagsFor(col.id).includes(v)"
                        @change="toggleTagFilter(col.id, v)"
                      />
                      <span>{{ v }}</span>
                    </label>
                    <div v-if="arrayValuesFor(col).length === 0" class="bases__multi-empty">
                      {{ t('bases.noValues') }}
                    </div>
                  </div>
                </details>
              </template>

              <!-- Number: > and < operators -->
              <template v-else-if="col.kind === 'number'">
                <input
                  type="number"
                  class="bases__filter-input"
                  :placeholder="t('bases.filterNumber')"
                  :value="(getFilterFor(col.id) && getFilterFor(col.id)!.op === '>') ? String(getFilterFor(col.id)!.value ?? '') : ''"
                  @input="(e) => setFilter(col.id, '>', (e.target as HTMLInputElement).value)"
                />
              </template>

              <!-- Boolean: tri-state select -->
              <template v-else-if="col.kind === 'boolean'">
                <select
                  class="bases__filter-input"
                  :value="getFilterFor(col.id) ? String(getFilterFor(col.id)!.value) : ''"
                  @change="(e) => {
                    const v = (e.target as HTMLSelectElement).value;
                    setFilter(col.id, 'equals', v === '' ? null : v === 'true');
                  }"
                >
                  <option value="">{{ t('bases.anyValue') }}</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </template>

              <!-- Text fallback -->
              <template v-else>
                <input
                  type="text"
                  class="bases__filter-input"
                  :placeholder="t('bases.filterText')"
                  :value="getFilterFor(col.id) ? String(getFilterFor(col.id)!.value ?? '') : ''"
                  @input="(e) => setFilter(col.id, 'contains', (e.target as HTMLInputElement).value)"
                />
              </template>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-if="visibleSlice.padTop > 0"
            class="bases__pad"
            :style="{ height: visibleSlice.padTop + 'px' }"
          ></tr>
          <tr
            v-for="entry in visibleRows"
            :key="entry.path"
            class="bases__row"
          >
            <td
              v-for="col in visibleColumns"
              :key="col.id"
              class="bases__td"
              :class="`bases__td--${col.kind}`"
            >
              <a
                v-if="col.id === 'name'"
                href="#"
                class="bases__link"
                @click.prevent="openEntry(entry)"
              >{{ cellText(entry, col) }}</a>
              <template v-else>{{ cellText(entry, col) }}</template>
            </td>
          </tr>
          <tr
            v-if="visibleSlice.padBottom > 0"
            class="bases__pad"
            :style="{ height: visibleSlice.padBottom + 'px' }"
          ></tr>
          <tr v-if="processedRows.length === 0">
            <td :colspan="visibleColumns.length" class="bases__empty-row">
              {{ t('bases.noMatch') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped src="./BasesView.css"></style>
