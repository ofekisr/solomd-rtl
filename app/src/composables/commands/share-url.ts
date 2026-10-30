export interface NoteLocation {
  folder: string | null | undefined;
  filePath: string | null | undefined;
  remoteUrl: string;
}

function relativeNotePath(folder: string, filePath: string): string | null {
  const sep = filePath.includes('\\') ? '\\' : '/';
  const folderNorm = folder.endsWith(sep) ? folder : folder + sep;
  if (!filePath.startsWith(folderNorm)) return null;
  return filePath.slice(folderNorm.length).split('\\').join('/');
}

/** Build a solomd.app/share/?repo=...&path=...&branch=main URL for the
 *  active tab, if it's inside a workspace linked to a public-looking
 *  GitHub remote. Returns null if any precondition fails — caller is
 *  responsible for surfacing a helpful toast. */
export function buildShareUrl({ folder, filePath, remoteUrl }: NoteLocation): string | null {
  if (!folder || !filePath) return null;
  const m = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i);
  if (!m) return null;
  const rel = relativeNotePath(folder, filePath);
  if (rel === null) return null;
  return `https://solomd.app/share/?repo=${m[1]}/${m[2]}&path=${encodeURIComponent(rel)}`;
}

/**
 * Repository-backed Git URL for the active note (Tolaria-parity "Copy Note
 * Git URL"). Builds `<host>/<owner>/<repo>/blob/<branch>/<path>` from the
 * linked remote + default branch, normalising ssh/https remotes. GitHub +
 * GitLab (which uses `/-/blob/`) are handled; other hosts fall through to the
 * GitHub-style `/blob/` path. Returns null when not in a git-linked workspace
 * or no note is open.
 */
export function buildGitUrl({ folder, filePath, remoteUrl }: NoteLocation): string | null {
  if (!folder || !filePath) return null;
  // host + owner/repo from either git@host:owner/repo.git or https://host/owner/repo(.git)
  const m = remoteUrl.match(/(?:@|:\/\/)([^/:]+)[:/]([^/]+)\/(.+?)(?:\.git)?$/i);
  if (!m) return null;
  const [, host, owner, repo] = m;
  const branch = 'main';
  const rel = relativeNotePath(folder, filePath);
  if (rel === null) return null;
  const encoded = rel.split('/').map(encodeURIComponent).join('/');
  const blobSeg = /gitlab/i.test(host) ? '/-/blob/' : '/blob/';
  return `https://${host}/${owner}/${repo}${blobSeg}${branch}/${encoded}`;
}
