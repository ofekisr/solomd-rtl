import { sepOf } from './useTreeDrag.ts';

const ORDER_DIR = '.solomd';
const ORDER_FILE = 'order.json';

export function joinPath(parent: string, name: string): string {
  const sep = parent.includes('\\') && !parent.includes('/') ? '\\' : '/';
  return parent.endsWith(sep) ? parent + name : parent + sep + name;
}

export function rootRelative(rootPath: string, p: string): string {
  const sep = sepOf(rootPath);
  const norm = rootPath.endsWith(sep) ? rootPath : rootPath + sep;
  return p.startsWith(norm) ? p.slice(norm.length).split('\\').join('/') : '';
}

export function segmentsUnderRoot(rootPath: string | undefined, path: string): string[] | null {
  if (!rootPath) return null;
  if (path === rootPath) return [];
  const sep = path.includes('\\') ? '\\' : '/';
  const rootNorm = rootPath.endsWith(sep) ? rootPath : rootPath + sep;
  return path.startsWith(rootNorm) ? path.slice(rootNorm.length).split(/[\\/]+/) : null;
}

export function orderKey(currentFolder: string | null, folder: string): string {
  return folder === currentFolder ? '' : rootRelative(currentFolder ?? '', folder);
}

export function orderFilePath(rootPath: string): string {
  return joinPath(joinPath(rootPath, ORDER_DIR), ORDER_FILE);
}

export function pathFromRelative(rootPath: string, relDir: string): string {
  return relDir === '' ? rootPath : relDir.split('/').reduce((acc, seg) => joinPath(acc, seg), rootPath);
}
