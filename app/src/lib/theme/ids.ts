import { MAX_ID_LENGTH } from './tokens.ts';

export const MARKETPLACE_PREFIX = 'mk-';
export const CSS_IMPORT_PREFIX = 'css-';

const PATH_SEPARATOR_RE = /[\\/]/;
const CSS_EXTENSION_RE = /\.css$/i;
const LOSSY_CHAR_RE = /[^A-Za-z0-9\s_-]/;
const NON_SLUG_RE = /[^a-z0-9]+/g;
const EDGE_DASH_RE = /^-+|-+$/g;
const HASH_LENGTH = 8;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const HEX_RADIX = 16;

export function fileStem(path: string): string {
  const fileName = path.split(PATH_SEPARATOR_RE).pop() ?? '';
  return fileName.replace(CSS_EXTENSION_RE, '');
}

function fnv1a(text: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), FNV_PRIME);
  return (hash >>> 0).toString(HEX_RADIX).padStart(HASH_LENGTH, '0');
}

function slugOf(stem: string): string {
  return stem.toLowerCase().replace(NON_SLUG_RE, '-').replace(EDGE_DASH_RE, '');
}

function hashedIdFor(prefix: string, stem: string, slug: string): string {
  const room = MAX_ID_LENGTH - prefix.length - HASH_LENGTH - 1;
  const head = slug.slice(0, room).replace(EDGE_DASH_RE, '');
  const hash = fnv1a(stem);
  return head ? `${prefix}${head}-${hash}` : `${prefix}${hash}`;
}

function plainIdFor(prefix: string, slug: string): string | null {
  const fits = slug.length <= MAX_ID_LENGTH - prefix.length;
  return fits && slug.length > 0 ? prefix + slug : null;
}

function prefixedIdFor(prefix: string, stem: string): string {
  const slug = slugOf(stem);
  const plain = plainIdFor(prefix, slug);
  if (!LOSSY_CHAR_RE.test(stem) && plain) return plain;
  return hashedIdFor(prefix, stem, slug);
}

export function marketplaceThemeId(manifestId: string): string {
  return prefixedIdFor(MARKETPLACE_PREFIX, manifestId);
}

export function marketplaceIdFor(cssPath: string): string {
  return marketplaceThemeId(fileStem(cssPath));
}

export function cssImportIdFor(cssPath: string): string {
  return prefixedIdFor(CSS_IMPORT_PREFIX, fileStem(cssPath));
}
