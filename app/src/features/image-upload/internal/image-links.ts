import { encodeImageDestination } from '../../../lib/md-image-url.ts';

export interface ImageSrcChange { from: number; to: number; insert: string }

const LOCAL_IMAGE_LINK = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const REMOTE_SRC = /^(https?:|data:)/i;
const SRC_OPEN_LENGTH = 2;

export function parseFrontMatterImageRoot(source: string): string | undefined {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  if (!fm) return undefined;
  const im = /^(?:imageRoot|image_root|typora-root-url)\s*:\s*(.+?)\s*$/m.exec(fm[1]);
  return im ? im[1].replace(/^["']|["']$/g, '').trim() || undefined : undefined;
}

export function localImageSources(doc: string): string[] {
  const re = new RegExp(LOCAL_IMAGE_LINK.source, 'g');
  const seen = new Set<string>();
  const sources: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(doc))) {
    const src = m[1];
    if (REMOTE_SRC.test(src) || seen.has(src)) continue;
    seen.add(src);
    sources.push(src);
  }
  return sources;
}

export function imageSrcChanges(doc: string, oldSrc: string, newUrl: string): ImageSrcChange[] {
  const changes: ImageSrcChange[] = [];
  const needle = `](${oldSrc})`;
  let idx = doc.indexOf(needle);
  while (idx >= 0) {
    const from = idx + SRC_OPEN_LENGTH;
    const to = idx + SRC_OPEN_LENGTH + oldSrc.length;
    changes.push({ from, to, insert: encodeImageDestination(newUrl) });
    idx = doc.indexOf(needle, idx + needle.length);
  }
  return changes;
}
