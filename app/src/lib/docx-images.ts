import { fsPort } from '../platform/index.ts';
import { resolveImagePath } from './image-resolve.ts';

/** Image cache: absolute path → { data, width, height, type } */
export interface ImageCache {
  data: Uint8Array;
  width: number;
  height: number;
  type: 'jpg' | 'png' | 'gif' | 'bmp';
}
const imageCache = new Map<string, ImageCache>();

export function clearImageCache(): void {
  imageCache.clear();
}

function imageTypeFromPath(path: string): 'jpg' | 'png' | 'gif' | 'bmp' {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg';
  if (ext === 'gif') return 'gif';
  if (ext === 'bmp') return 'bmp';
  return 'png';
}

export async function fetchImageBytes(absPath: string): Promise<ImageCache | null> {
  const cached = imageCache.get(absPath);
  if (cached) return cached;

  try {
    const data = await fsPort.readBinaryFile({ path: absPath });
    const bytes = new Uint8Array(data);

    const { width, height } = readImageDimensions(bytes) ?? { width: 400, height: 300 };

    const result: ImageCache = {
      data: bytes,
      width,
      height,
      type: imageTypeFromPath(absPath),
    };
    imageCache.set(absPath, result);
    return result;
  } catch {
    return null;
  }
}

/** Read width/height from PNG/JPEG/GIF/BMP headers without decoding the full image. */
export function readImageDimensions(data: Uint8Array): { width: number; height: number } | null {
  // PNG: bytes 16-23 are width (4B BE) + height (4B BE)
  if (data[0] === 0x89 && data[1] === 0x50 /* P */) {
    const w = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
    const h = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];
    if (w > 0 && h > 0) return { width: w, height: h };
  }
  // JPEG: scan SOF0/SOF2 marker (0xFFC0 / 0xFFC2)
  if (data[0] === 0xFF && data[1] === 0xD8) {
    let i = 2;
    while (i < data.length - 8) {
      if (data[i] !== 0xFF) break;
      const marker = data[i + 1];
      if (marker === 0xC0 || marker === 0xC2) {
        const h = (data[i + 5] << 8) | data[i + 6];
        const w = (data[i + 7] << 8) | data[i + 8];
        if (w > 0 && h > 0) return { width: w, height: h };
      }
      const segLen = ((data[i + 2] << 8) | data[i + 3]) + 2;
      if (segLen < 3) break;
      i += segLen;
    }
  }
  // GIF: little-endian width/height at offset 6-9
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46 /* GIF */) {
    const w = data[6] | (data[7] << 8);
    const h = data[8] | (data[9] << 8);
    if (w > 0 && h > 0) return { width: w, height: h };
  }
  // BMP: little-endian at offset 18-25
  if (data[0] === 0x42 && data[1] === 0x4D) {
    const w = data[18] | (data[19] << 8) | (data[20] << 16) | (data[21] << 24);
    const h = Math.abs(data[22] | (data[23] << 8) | (data[24] << 16) | (data[25] << 24));
    if (w > 0 && h > 0) return { width: w, height: h };
  }
  return null;
}

/** Max image width in the DOCX (pixels at 96dpi). */
const MAX_IMG_WIDTH = 580;

export function scaleDimensions(w: number, h: number): { width: number; height: number } {
  if (w > MAX_IMG_WIDTH) {
    const ratio = MAX_IMG_WIDTH / w;
    w = MAX_IMG_WIDTH;
    h = Math.round(h * ratio);
  }
  return { width: w, height: h };
}

/** Resolve an image src from markdown to an absolute local path. Returns null for remote URLs. */
export function resolveLocalImagePath(src: string, imageRoot: string | null, filePath?: string): string | null {
  if (!src || /^(https?|data|blob|asset|tauri):/i.test(src)) return null;
  const resolved = resolveImagePath(src, imageRoot, filePath);
  if (/^(https?|data|blob|asset|tauri):/i.test(resolved)) return null;
  return resolved;
}
