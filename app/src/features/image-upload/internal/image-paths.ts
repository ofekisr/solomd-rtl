/** Minimal front-matter imageRoot parser (kept local to avoid import cycles). */
export function parseImageRootFast(source: string): string | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!m) return null;
  const im = /^(?:imageRoot|image_root|typora-root-url)\s*:\s*(.+?)\s*$/m.exec(m[1]);
  if (!im) return null;
  return im[1].replace(/^["']|["']$/g, '').trim() || null;
}

const IMAGE_MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
};

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function timestamp(): string {
  const d = new Date();
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    '-' +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

export function randSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export function extFromMime(mime: string): string {
  return IMAGE_MIME_EXT[mime.toLowerCase()] || 'png';
}

export function extFromName(name: string): string | undefined {
  const i = name.lastIndexOf('.');
  if (i < 0) return undefined;
  return name.slice(i + 1).toLowerCase();
}

export function dirnameOf(p: string, sepCh: string): string {
  // Strip trailing separator.
  let end = p.length;
  while (end > 0 && (p[end - 1] === '/' || p[end - 1] === '\\')) end--;
  let i = end - 1;
  while (i >= 0 && p[i] !== '/' && p[i] !== '\\') i--;
  if (i < 0) return '.';
  if (i === 0) return p[0] === '/' ? '/' : p.slice(0, 1);
  return p.slice(0, i) || sepCh;
}

/** Basename of a path without its extension. `/a/b/foo.md` → `foo`. Used
 *  in per-file attachment mode to derive `<basename>.assets/`. */
export function basenameNoExt(p: string): string {
  let start = p.length - 1;
  while (start >= 0 && p[start] !== '/' && p[start] !== '\\') start--;
  const base = p.slice(start + 1);
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

/** Compute the assets directory + URL-encodable folder segment for the
 *  current attachment mode. Returns `null` when there's no file path (caller
 *  must fall back to the temp-dir branch). */
export function resolveAssetsDir(
  filePath: string,
  sepCh: string,
  mode: 'shared' | 'per-file' | 'custom',
  sharedDirName: string,
  customPath?: string,
): { dir: string; urlPrefix: string } {
  const parent = dirnameOf(filePath, sepCh);
  if (mode === 'per-file') {
    const stem = basenameNoExt(filePath);
    const folder = `${stem}.assets`;
    return { dir: joinPath(parent, folder, sepCh), urlPrefix: folder };
  }
  if (mode === 'custom') {
    // #7 — Typora-style template, e.g. `./images/${filename}/`. Expand the
    // `${filename}` token (note stem) and normalize to forward slashes for the
    // markdown URL; the on-disk dir is rebuilt with the platform separator.
    const stem = basenameNoExt(filePath);
    const raw = (customPath || './images/${filename}/').trim();
    const urlPrefix = raw
      .replace(/\$\{filename\}/g, stem)
      .replace(/\\/g, '/')
      .replace(/\/+$/, ''); // drop trailing slash; `${urlPrefix}/${file}` re-adds it
    // Absolute? (`/…`, `~…`, or `C:\…`) → use as-is; otherwise join onto the
    // note's folder. `./` and `.` segments are dropped when building the dir.
    const isAbs = /^([/~]|[A-Za-z]:[\\/])/.test(raw);
    let dir: string;
    if (isAbs) {
      dir = urlPrefix.replace(/\//g, sepCh);
    } else {
      const segs = urlPrefix.split('/').filter((s) => s !== '' && s !== '.');
      dir = parent;
      for (const s of segs) dir = joinPath(dir, s, sepCh);
    }
    if (!dir.endsWith(sepCh)) dir += sepCh;
    return { dir, urlPrefix };
  }
  return { dir: joinPath(parent, sharedDirName, sepCh), urlPrefix: sharedDirName };
}

export function joinPath(a: string, b: string, sepCh: string): string {
  if (!a) return b;
  if (a.endsWith('/') || a.endsWith('\\')) return a + b;
  return a + sepCh + b;
}

export function makeFilename(ext: string): string {
  return `image-${timestamp()}-${randSuffix()}.${ext}`;
}
