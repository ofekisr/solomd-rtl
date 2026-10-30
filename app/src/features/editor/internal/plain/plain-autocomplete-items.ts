import type { CitationEntry } from '../../../../lib/citations.ts';
import { filterFenceLanguages } from '../../../../lib/fence-languages.ts';
import { getRecentFenceLanguages } from '../../../../lib/fence-recents.ts';
import { expandSnippet, filterBlocks, SLASH_BLOCKS } from '../../../../lib/slash-blocks.ts';

export type AcKind = 'slash' | 'wikilink' | 'tag' | 'citation' | 'fence';
export interface AcItem { label: string; hint?: string; insert: string; cursorOffset: number; fenceLanguage?: string }

export interface AcSources {
  notes(): ReadonlyArray<{ title?: string | null; path: string }>;
  tags(): ReadonlyArray<{ tag: string; count: number }>;
  citations(): ReadonlyArray<CitationEntry>;
}

export function baseNoteName(path: string): string {
  return (path.split(/[\\/]/).pop() || path).replace(/\.md$/i, '');
}

export function buildAcItems(kind: AcKind, query: string, sources: AcSources): AcItem[] {
  const q = query.toLowerCase();
  if (kind === 'slash') {
    return filterBlocks(SLASH_BLOCKS, query).slice(0, 8).map((b) => {
      const ex = expandSnippet(b.snippet, '');
      return { label: b.label, hint: b.hint, insert: ex.text, cursorOffset: ex.cursorOffset };
    });
  }
  if (kind === 'wikilink') {
    return sources.notes()
      .map((e) => e.title || baseNoteName(e.path))
      .filter((n) => n && n.toLowerCase().includes(q))
      .slice(0, 8)
      .map((n) => ({ label: n, hint: 'wiki', insert: `[[${n}]]`, cursorOffset: n.length + 4 }));
  }
  if (kind === 'tag') {
    return sources.tags()
      .filter((t) => t.tag.toLowerCase().includes(q))
      .slice(0, 8)
      .map((t) => ({ label: `#${t.tag}`, hint: String(t.count), insert: `#${t.tag} `, cursorOffset: t.tag.length + 2 }));
  }
  if (kind === 'fence') {
    const recents = getRecentFenceLanguages();
    return filterFenceLanguages(query, 10, recents).map((lang) => ({
      label: lang.name,
      hint: recents.includes(lang.name.toLowerCase()) ? ['★', lang.hint].filter(Boolean).join(' ') : lang.hint,
      insert: lang.name,
      cursorOffset: lang.name.length,
      fenceLanguage: lang.name,
    }));
  }
  return sources.citations()
    .filter((c) => (c.key || '').toLowerCase().includes(q))
    .slice(0, 8)
    .map((c) => ({ label: `@${c.key}`, hint: (c.title ? String(c.title).slice(0, 32) : ''), insert: `@${c.key} `, cursorOffset: c.key.length + 2 }));
}
