/**
 * #116 — resolve a relative markdown link against the current file's path.
 * Robust to (a) Windows back-slash separators, (b) percent-encoded hrefs
 * (CJK filenames / spaces are URL-encoded by the renderer), and (c) `../` /
 * `./` traversal. The result is emitted in the base path's separator style so
 * the Rust side opens it on every platform.
 */
export function resolveRelativePath(basePath: string, href: string): string {
  // Strip any #fragment / ?query the anchor may carry, then decode.
  let rel = href.replace(/[#?].*$/, '');
  try {
    rel = decodeURIComponent(rel);
  } catch {
    /* malformed encoding — fall back to the raw href */
  }
  const winStyle = basePath.includes('\\') && !basePath.includes('/');
  const sepCh = winStyle ? '\\' : '/';
  // #138 — a UNC path (`\\server\share\…`, or WSL's `\\wsl$\Ubuntu\…` /
  // `\\wsl.localhost\…`) starts with a DOUBLE separator. Splitting on
  // `[\\/]+` collapses that pair into one match, so a naive join emits a
  // single leading `\` — an invalid path that Rust's `fs::read` rejects with
  // os error 3. Detect it and restore the second leading separator.
  const isUnc = /^[\\/]{2}/.test(basePath);
  // Directory segments of the current file (drop the file name itself).
  const segs = basePath.split(/[\\/]+/);
  segs.pop();
  for (const part of rel.split(/[\\/]+/)) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (segs.length > 1) segs.pop();
      continue;
    }
    segs.push(part);
  }
  const joined = segs.join(sepCh);
  return isUnc ? sepCh + joined : joined;
}
