import type { Tab } from '../../types';

const IOS_CONTAINER_PATTERN = /\/Data\/Application\/[^/]+\//;
const IOS_CONTAINER_PREFIX = /^.*?\/Data\/Application\/[^/]+/;
const DOCUMENTS_SUFFIX = /\/Documents\/?$/;
const HEADING_HEAD_BYTES = 512;

/** #160 — pre-fill the Save dialog from the document's first heading. A
 *  never-saved tab still carries the default "Untitled" name, so a note that
 *  opens with `# Meeting notes` saves as `Meeting notes.md` without retyping. Inert
 *  once the tab has a real path or a user-chosen name. */
export function deriveNameFromHeading(tab: Pick<Tab, 'filePath' | 'fileName' | 'content' | 'language'>): string | null {
  if (tab.filePath || !/^Untitled(\.(md|txt))?$/i.test(tab.fileName ?? '')) return null;
  const m = tab.content?.match(/^#{1,6}[ \t]+(.{1,60})/m);
  const stem = m?.[1]?.trim().replace(/[\\/:*?"<>|#]/g, '_').replace(/^\.+/, '').trim();
  if (!stem || /^[_\s.]*$/.test(stem)) return null;
  return tab.language === 'markdown' ? `${stem}.md` : `${stem}.txt`;
}

/** Display name for a content:// URI ("…%2Fnote.md" → "note.md"). */
export function contentUriName(uri: string): string {
  try {
    return decodeURIComponent(uri).split(/[\\/:]/).filter(Boolean).pop() ?? uri;
  } catch {
    return uri.split(/[\\/]/).pop() ?? uri;
  }
}

/** File name for bytes imported from a SAF `content://` URI: the name the URI
 *  encodes, else the first Markdown heading of a text payload, else a
 *  timestamped name. */
export function contentUriFileName(uri: string, bytes: Uint8Array, now: number): string {
  let name = '';
  try {
    const seg = decodeURIComponent(uri).split(/[/:]/).filter(Boolean).pop() ?? '';
    if (/\.[A-Za-z0-9]{1,8}$/.test(seg)) name = seg.replace(/[\\/:*?"<>|]/g, '_');
  } catch {
    /* malformed encoding — fall through to the timestamped name */
  }
  if (!name) {
    const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, HEADING_HEAD_BYTES));
    if (!head.includes('\u0000')) {
      const m = head.match(/^#{1,6}[ \t]+(.{1,60})/m);
      const stem = m?.[1]?.trim().replace(/[\\/:*?"<>|#]/g, '_');
      if (stem) name = `${stem}.md`;
    }
  }
  return name || `imported-${now}.md`;
}

/** #139 — `file://` URL (iOS Files-app opens) → plain filesystem path. */
export function stripFileUrl(path: string): string {
  if (!path.startsWith('file://')) return path;
  const stripped = path.replace(/^file:\/\/(localhost)?/, '');
  try {
    return decodeURIComponent(stripped);
  } catch {
    return stripped;
  }
}

export function isIosContainerPath(path: string): boolean {
  return IOS_CONTAINER_PATTERN.test(path);
}

/** #139 — re-anchor a stored iOS container path onto the current container
 *  root (`documentDir` is `…/Data/Application/<current>/Documents`). Anchored
 *  on `/Data/Application/` (lazy `.*?` = first occurrence): a bare
 *  `/Application/` would eat a user folder of that name and mis-rewrite
 *  app-BUNDLE paths. */
export function reanchorIosPath(path: string, documentDir: string): string {
  const curRoot = documentDir.replace(DOCUMENTS_SUFFIX, '');
  return path.replace(IOS_CONTAINER_PREFIX, curRoot);
}
