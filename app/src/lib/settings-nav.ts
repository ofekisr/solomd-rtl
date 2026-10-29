export type SettingsCategory = 'basics' | 'theme' | 'writing' | 'mindmap' | 'sync' | 'integrations' | 'export' | 'keys' | 'advanced';
export type PageKey = string;

export interface NavPage {
  id: string;
  labelKey: string;
}

export interface NavCategory {
  id: SettingsCategory;
  icon: string;
  labelKey: string;
  pages: readonly NavPage[];
}

const MAIN = 'main';

function single(id: SettingsCategory, icon: string, labelKey: string): NavCategory {
  return { id, icon, labelKey, pages: [{ id: MAIN, labelKey }] };
}

export const SETTINGS_NAV: readonly NavCategory[] = [
  {
    id: 'basics', icon: '⚙️', labelKey: 'settings.catBasics', pages: [
      { id: 'language', labelKey: 'settings.pageLanguage' },
      { id: 'fonts', labelKey: 'settings.pageFonts' },
      { id: 'editor', labelKey: 'settings.pageEditor' },
      { id: 'sidebar', labelKey: 'settings.pageSidebar' },
      { id: 'preview', labelKey: 'settings.pagePreview' },
    ],
  },
  single('theme', '🎨', 'themeStudio.navLabel'),
  {
    id: 'writing', icon: '✍️', labelKey: 'settings.catWriting', pages: [
      { id: 'aids', labelKey: 'settings.pageAids' },
      { id: 'focus', labelKey: 'settings.pageFocus' },
      { id: 'attachments', labelKey: 'settings.pageAttachments' },
      { id: 'image-upload', labelKey: 'settings.pageImageUpload' },
      { id: 'inbox', labelKey: 'settings.pageInbox' },
    ],
  },
  single('mindmap', '🧠', 'settings.catMindmap'),
  single('sync', '☁️', 'settings.catSync'),
  single('integrations', '🔌', 'settings.catIntegrations'),
  single('export', '📤', 'settings.catExport'),
  single('keys', '⌨️', 'settings.catKeys'),
  {
    id: 'advanced', icon: '🛠️', labelKey: 'settings.catAdvanced', pages: [
      { id: 'startup', labelKey: 'settings.pageStartup' },
      { id: 'files', labelKey: 'settings.pageFiles' },
      { id: 'updates', labelKey: 'settings.pageUpdates' },
    ],
  },
];

const KEY_SEPARATOR = '/';

function keyOf(cat: SettingsCategory, page: string): PageKey {
  return `${cat}${KEY_SEPARATOR}${page}`;
}

export const ALL_PAGE_KEYS: readonly PageKey[] = SETTINGS_NAV.flatMap((c) => c.pages.map((p) => keyOf(c.id, p.id)));
const KNOWN_KEYS = new Set(ALL_PAGE_KEYS);

function findCategory(id: string): NavCategory | undefined {
  return SETTINGS_NAV.find((c) => c.id === id);
}

export function defaultPage(cat: SettingsCategory): PageKey {
  const found = findCategory(cat);
  return keyOf(cat, found ? found.pages[0].id : MAIN);
}

export function parsePageKey(raw: string | null | undefined): PageKey | null {
  if (!raw) return null;
  if (KNOWN_KEYS.has(raw)) return raw;
  const cat = findCategory(raw);
  return cat ? defaultPage(cat.id) : null;
}

export function categoryOf(key: PageKey): SettingsCategory {
  return key.split(KEY_SEPARATOR)[0] as SettingsCategory;
}

export function isMultiPage(cat: SettingsCategory): boolean {
  return (findCategory(cat)?.pages.length ?? 0) > 1;
}

export function crumbsOf(key: PageKey): { categoryLabelKey: string; pageLabelKey: string | null } {
  const cat = findCategory(categoryOf(key));
  if (!cat) return { categoryLabelKey: '', pageLabelKey: null };
  const pageId = key.slice(cat.id.length + KEY_SEPARATOR.length);
  const page = cat.pages.find((p) => p.id === pageId);
  return { categoryLabelKey: cat.labelKey, pageLabelKey: isMultiPage(cat.id) && page ? page.labelKey : null };
}

export function pageVisibilityCss(key: PageKey | null): string {
  if (!key || !KNOWN_KEYS.has(key)) return '';
  return `.settings__body[data-active-page="${key}"] > [data-page="${key}"] { display: flex; flex-direction: column; gap: 8px; }`;
}
