import ts from 'typescript';
import { listSourceFiles, readRepoFile } from './scan.ts';

const FEATURE_ROOTS: readonly string[] = ['app/src/features'];
const FEATURE_EXTS: readonly string[] = ['.ts', '.vue'];
const REACTIVE_EXACT = new Set(['vue', 'pinia']);
const REACTIVE_PREFIX = 'vue/';
const UI_SEGMENT = '/ui/';
const COMPOSABLE_RE = /^use[A-Z][^/]*\.ts$/;
const STORE_SUFFIX = '.store.ts';
const SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
const UNKNOWN_MODULE = 'vue or pinia';

export interface FeaturePurityViolation {
  path: string;
  module: string;
}

export function isReactiveImport(specifier: string): boolean {
  return REACTIVE_EXACT.has(specifier) || specifier.startsWith(REACTIVE_PREFIX);
}

export function mayImportReactive(path: string): boolean {
  const base = path.slice(path.lastIndexOf('/') + 1);
  return path.includes(UI_SEGMENT) || COMPOSABLE_RE.test(base) || base.endsWith(STORE_SUFFIX);
}

function isTypeOnlyImport(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  const named = clause.namedBindings;
  const hasOnlyNamed = !clause.name && named !== undefined && ts.isNamedImports(named);
  return hasOnlyNamed && named.elements.length > 0 && named.elements.every((element) => element.isTypeOnly);
}

function moduleName(node: ts.Node): string | undefined {
  if (ts.isImportDeclaration(node) && !isTypeOnlyImport(node) && ts.isStringLiteral(node.moduleSpecifier)) return node.moduleSpecifier.text;
  if (ts.isExportDeclaration(node) && !node.isTypeOnly && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) return node.moduleSpecifier.text;
  if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    const [arg] = node.arguments;
    return arg && ts.isStringLiteralLike(arg) ? arg.text : undefined;
  }
  return undefined;
}

export function runtimeImports(source: string, path: string): string[] {
  const code = path.endsWith('.vue') ? [...source.matchAll(SCRIPT_BLOCK)].map((match) => match[1]).join('\n') : source;
  const file = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    const name = moduleName(node);
    if (name !== undefined) found.push(name);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

export function collectFeaturePurityViolations(repoRoot: string): FeaturePurityViolation[] {
  return listSourceFiles(repoRoot, FEATURE_ROOTS, FEATURE_EXTS)
    .filter((path) => !mayImportReactive(path))
    .flatMap((path) => {
      const module = runtimeImports(readRepoFile(repoRoot, path), path).find(isReactiveImport);
      return module === undefined ? [] : [{ path, module }];
    });
}

export function collectFeaturePurity(repoRoot: string): string[] {
  return collectFeaturePurityViolations(repoRoot).map((violation) => violation.path);
}

export function checkFeaturePurity(
  current: readonly string[],
  baseline: readonly string[],
  modules: ReadonlyMap<string, string> = new Map(),
): string[] {
  const allowed = new Set(baseline);
  return current.filter((path) => !allowed.has(path)).map((path) => featurePurityMessage(path, modules.get(path) ?? UNKNOWN_MODULE));
}

function featurePurityMessage(path: string, module: string): string {
  return `[arch:feature-purity] ${path} imports ${module}. Only ui/, use*.ts and *.store.ts may import vue/pinia under features/. See app/arch/CLAUDE.md.`;
}
