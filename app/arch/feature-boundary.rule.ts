import { posix } from 'node:path';
import { extractImports, listSourceFiles, readRepoFile } from './scan.ts';

const SOURCE_ROOTS: readonly string[] = ['app/src'];
const SOURCE_EXTS: readonly string[] = ['.ts', '.vue'];
const INTERNAL_PATH_RE = /^app\/src\/features\/([^/]+)\/internal(?:\/|$)/;
const FEATURE_PATH_RE = /^app\/src\/features\/([^/]+)\//;
const RELATIVE_PREFIX = '.';

export function findBoundaryViolation(importer: string, specifier: string): string | null {
  if (!specifier.startsWith(RELATIVE_PREFIX)) return null;
  const target = posix.normalize(posix.join(posix.dirname(importer), specifier));
  const targetFeature = INTERNAL_PATH_RE.exec(target)?.[1];
  if (targetFeature === undefined) return null;
  return FEATURE_PATH_RE.exec(importer)?.[1] === targetFeature ? null : target;
}

export function checkFeatureBoundary(repoRoot: string): string[] {
  return listSourceFiles(repoRoot, SOURCE_ROOTS, SOURCE_EXTS).flatMap((importer) =>
    extractImports(readRepoFile(repoRoot, importer), importer).flatMap((specifier) => {
      const target = findBoundaryViolation(importer, specifier);
      return target === null ? [] : [boundaryMessage(importer, target)];
    }),
  );
}

function boundaryMessage(importer: string, target: string): string {
  const feature = INTERNAL_PATH_RE.exec(target)?.[1] ?? '';
  return `[arch:feature-boundary] ${importer} imports ${target}, which is private to feature "${feature}". Import from app/src/features/${feature}/contracts/ instead. See app/arch/CLAUDE.md.`;
}
