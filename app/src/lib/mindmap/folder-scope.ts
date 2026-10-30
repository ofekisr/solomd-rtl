export type ScopeKind = 'include' | 'exclude';
export type ScopeState = 'included' | 'excluded' | 'partial';
export interface ScopeRule { kind: ScopeKind; isRecursive: boolean }
export type ScopeRules = ReadonlyMap<string, ScopeRule>;

const ROOT_PATH = '';
const PATH_SEPARATOR = '/';
const HIDDEN_PREFIX = '.';
const OPT_IN_NAMES = new Set(['node_modules']);
const PROBE_NAME = 'probe';

export function defaultScopeRules(): Map<string, ScopeRule> {
  return new Map([[ROOT_PATH, { kind: 'include', isRecursive: true }]]);
}

export function parentOf(path: string): string {
  const cut = path.lastIndexOf(PATH_SEPARATOR);
  return cut < 0 ? ROOT_PATH : path.slice(0, cut);
}

export function joinPath(parent: string, name: string): string {
  return parent === ROOT_PATH ? name : `${parent}${PATH_SEPARATOR}${name}`;
}

export function isStrictlyUnder(path: string, ancestor: string): boolean {
  if (path === ancestor) return false;
  return ancestor === ROOT_PATH || path.startsWith(`${ancestor}${PATH_SEPARATOR}`);
}

export function isOptInName(name: string): boolean {
  return name.startsWith(HIDDEN_PREFIX) || OPT_IN_NAMES.has(name);
}

function hasOptInBelow(ancestor: string, path: string): boolean {
  const rest = ancestor === ROOT_PATH ? path : path.slice(ancestor.length + 1);
  return rest.split(PATH_SEPARATOR).some(isOptInName);
}

function inheritedRule(path: string, isDir: boolean, rules: ScopeRules): { from: string; rule: ScopeRule } | undefined {
  const own = rules.get(path);
  if (own) return { from: path, rule: own };
  let ancestor = path;
  while (ancestor !== ROOT_PATH) {
    ancestor = parentOf(ancestor);
    const rule = rules.get(ancestor);
    const isDirectFile = !isDir && ancestor === parentOf(path);
    if (rule && (rule.isRecursive || isDirectFile)) return { from: ancestor, rule };
  }
  return undefined;
}

export function isPathIncluded(path: string, isDir: boolean, rules: ScopeRules): boolean {
  const match = inheritedRule(path, isDir, rules);
  if (!match || match.rule.kind === 'exclude') return false;
  return match.from === path || !hasOptInBelow(match.from, path);
}

export function hasIncludeBelow(folder: string, rules: ScopeRules): boolean {
  for (const [path, rule] of rules) {
    if (rule.kind === 'include' && isStrictlyUnder(path, folder)) return true;
  }
  return false;
}

export function folderState(folder: string, rules: ScopeRules): ScopeState {
  const isIncluded = isPathIncluded(folder, true, rules);
  const probe = joinPath(folder, PROBE_NAME);
  const probesDiffer = [true, false].some((isDir) => isPathIncluded(probe, isDir, rules) !== isIncluded);
  const hasDifferentRuleBelow = [...rules].some(([path, rule]) =>
    isStrictlyUnder(path, folder) && (rule.kind === 'include') !== isIncluded);
  if (probesDiffer || hasDifferentRuleBelow) return 'partial';
  return isIncluded ? 'included' : 'excluded';
}

export function applyScope(
  rules: ScopeRules, targets: readonly { path: string; isDir: boolean }[], kind: ScopeKind, isRecursive: boolean,
): Map<string, ScopeRule> {
  const next = new Map(rules);
  for (const target of targets) {
    const recursive = isRecursive && target.isDir;
    if (recursive) [...next.keys()].filter((path) => isStrictlyUnder(path, target.path)).forEach((path) => next.delete(path));
    next.set(target.path, { kind, isRecursive: recursive });
  }
  return next;
}
