import { computed, nextTick, onUnmounted, ref, watch, watchEffect, type ComputedRef, type Ref } from 'vue';
import { getDict } from '../../../i18n';
import { ALL_PAGE_KEYS, pageVisibilityCss, type PageKey } from '../../../lib/settings-nav';
import { blockMatches, englishFallbackNeedles, flatten, normalize, queryMatcher } from '../../../lib/settings-search';
import { useSettingsStore } from '../../../stores/settings';
import type { SettingsPanelProps } from './settings-panel-props.ts';

/**
 * #352 — search across every category.
 *
 * Filtering works on what is rendered: each top-level `[data-cat]` block of
 * the body is matched against its own text, so nothing has to be listed a
 * second time. English keywords also work in a translated UI (see
 * lib/settings-search.ts). While a query is active the pages are switched
 * off (no data-active-page) and the matches are shown grouped under their
 * page breadcrumbs, in page order (CSS `order`).
 */

/* Scoped CSS would tag the hide rule with the scope attribute and outrank the
   generated show rule, so both live in this one unscoped sheet. */
const PAGE_STYLE_ID = 'settings-page-visibility';
const HIDE_INACTIVE_PAGES_CSS = '.settings__body[data-active-page] > [data-cat] { display: none; }';
const HIGHLIGHT = 'settings-search';
const MAX_HIGHLIGHT_RANGES = 500;
const NO_PAGE_ORDER = 999;
const LATIN_NEEDLE = /^[a-z0-9 ._+#-]+$/;
const WORD_CHAR = /[a-z0-9]/;

interface FlatDicts {
  lang: string;
  en: Map<string, string>;
  cur: Map<string, string>;
}

interface HighlightRegistry {
  set: (name: string, highlight: unknown) => void;
  delete?: (name: string) => void;
}

type HighlightCtor = new (...ranges: Range[]) => unknown;

interface HighlightGlobals {
  CSS?: { highlights?: HighlightRegistry };
  Highlight?: HighlightCtor;
}

const highlightGlobals = (): HighlightGlobals => globalThis as unknown as HighlightGlobals;

export function clearHighlight(): void {
  highlightGlobals().CSS?.highlights?.delete?.(HIGHLIGHT);
}

function collectRanges(block: HTMLElement, needles: string[], ranges: Range[]): void {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode()) && ranges.length < MAX_HIGHLIGHT_RANGES) {
    if ((node as Text).parentElement?.closest('select, option, textarea')) continue;
    const text = (node.nodeValue || '').toLowerCase();
    for (const n of needles) collectNeedleRanges(node, text, n, ranges);
  }
}

function collectNeedleRanges(node: Node, text: string, needle: string, ranges: Range[]): void {
  const latin = LATIN_NEEDLE.test(needle);
  let i = needle ? text.indexOf(needle) : -1;
  while (i >= 0 && ranges.length < MAX_HIGHLIGHT_RANGES) {
    if (!latin || i === 0 || !WORD_CHAR.test(text[i - 1])) {
      const r = document.createRange();
      r.setStart(node, i);
      r.setEnd(node, i + needle.length);
      ranges.push(r);
    }
    i = text.indexOf(needle, i + needle.length);
  }
}

/**
 * Mark the matched words with the CSS Custom Highlight API — no DOM edits,
 * so Vue's text nodes are left alone. Skipped where unsupported.
 * A block that contains the typed query gets only the query marked; the
 * English-fallback needles (whole translated sentences) are marked only in
 * blocks that matched through them alone, or the page turns into a wall of
 * orange.
 */
function highlight(blocks: HTMLElement[], query: string, fallback: string[]): void {
  const { CSS: css, Highlight } = highlightGlobals();
  if (!css?.highlights || !Highlight) return;
  const ranges: Range[] = [];
  const hasQuery = queryMatcher(query);
  for (const b of blocks) {
    collectRanges(b, hasQuery(b.textContent || '') ? [query] : fallback, ranges);
  }
  css.highlights.set(HIGHLIGHT, new Highlight(...ranges));
}

export interface SettingsSearchDeps {
  bodyEl: Ref<HTMLElement | null>;
  searchQuery: Ref<string>;
  activePage: Ref<PageKey>;
}

export interface SettingsSearch {
  searchInput: Ref<HTMLInputElement | null>;
  searching: ComputedRef<boolean>;
  searchHitCount: Ref<number>;
  pagesWithHits: Ref<Set<string>>;
}

export function useSettingsSearch(props: SettingsPanelProps, deps: SettingsSearchDeps): SettingsSearch {
  const { bodyEl, searchQuery, activePage } = deps;
  const settings = useSettingsStore();
  const searchInput = ref<HTMLInputElement | null>(null);
  const searching = computed(() => normalize(searchQuery.value).length > 0);
  const searchHitCount = ref(0);
  const pagesWithHits = ref<Set<string>>(new Set());
  const pageOrder = new Map(ALL_PAGE_KEYS.map((k, i) => [k, i]));
  let flatCache: FlatDicts | null = null;
  let bodyObserver: MutationObserver | null = null;

  watchEffect(() => {
    const css = pageVisibilityCss(searching.value ? null : activePage.value);
    let el = document.getElementById(PAGE_STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = PAGE_STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = `${HIDE_INACTIVE_PAGES_CSS}\n${css}`;
  });
  onUnmounted(() => document.getElementById(PAGE_STYLE_ID)?.remove());

  function dictsFor(lang: string): FlatDicts {
    if (!flatCache || flatCache.lang !== lang) {
      const en = flatten(getDict('en'));
      flatCache = { lang, en, cur: lang === 'en' ? en : flatten(getDict(lang)) };
    }
    return flatCache;
  }

  function resetSearch(blocks: HTMLElement[]): void {
    for (const b of blocks) {
      delete b.dataset.match;
      b.style.order = '';
    }
    searchHitCount.value = 0;
    pagesWithHits.value = new Set();
    clearHighlight();
  }

  function applySearch(): void {
    const body = bodyEl.value;
    if (!body) return;
    const blocks = Array.from(body.children).filter(
      (el): el is HTMLElement => el instanceof HTMLElement && !!el.dataset.cat,
    );
    if (!searching.value) return resetSearch(blocks);
    const q = searchQuery.value;
    const { en, cur } = dictsFor(settings.language);
    const needles = englishFallbackNeedles(q, en, cur);
    const pages = new Set<string>();
    const hits: HTMLElement[] = [];
    for (const b of blocks) {
      const page = b.dataset.page!;
      const match = blockMatches(b.textContent || '', q, needles);
      b.dataset.match = match ? '1' : '0';
      b.style.order = String((pageOrder.get(page) ?? NO_PAGE_ORDER) * 2 + 1);
      if (match) {
        pages.add(page);
        hits.push(b);
      }
    }
    searchHitCount.value = hits.length;
    pagesWithHits.value = pages;
    highlight(hits, normalize(q), needles);
  }

  /** Blocks appear and disappear with settings (v-if), so re-filter on changes. */
  watch([searchQuery, () => props.open, () => settings.language], async () => {
    await nextTick();
    applySearch();
    bodyObserver?.disconnect();
    bodyObserver = null;
    if (props.open && searching.value && bodyEl.value) {
      bodyObserver = new MutationObserver(() => applySearch());
      bodyObserver.observe(bodyEl.value, { childList: true });
    }
    if (searching.value) bodyEl.value?.scrollTo({ top: 0 });
  });

  onUnmounted(() => {
    bodyObserver?.disconnect();
    clearHighlight();
  });

  return { searchInput, searching, searchHitCount, pagesWithHits };
}
