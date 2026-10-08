import { invoke } from '@tauri-apps/api/core';

export interface DirectiveGrammar {
  opening: string;
  marker: string;
  closing: string;
  pairSeparator: string;
  keyValueSeparator: string;
}

export interface DirectiveDefinition {
  key: string;
  type: string;
  values: readonly string[];
  default?: string;
  label?: string;
  description?: string;
}

export interface LoadedDirectiveCompletionManifest {
  sourceFile: string;
  schemaVersion: 1;
  grammar: DirectiveGrammar;
  directives: readonly DirectiveDefinition[];
}

export interface DirectiveCompletionWarning {
  sourceFile: string;
  reason: string;
}

export interface DirectiveCompletionLoadResult {
  manifests: readonly LoadedDirectiveCompletionManifest[];
  warnings: readonly DirectiveCompletionWarning[];
  directory: string;
}

export interface DirectiveCompletionSettingsStatus {
  loaded: number;
  warningCount: number;
}

const EMPTY_RESULT = freezeLoadResult({
  directory: '',
  manifests: [],
  warnings: [],
});

let installedResult: Readonly<DirectiveCompletionLoadResult> = EMPTY_RESULT;

export function installDirectiveCompletionLoadResult(
  result: DirectiveCompletionLoadResult,
): void {
  installedResult = freezeLoadResult(result);
}

export function directiveCompletionManifests(): readonly LoadedDirectiveCompletionManifest[] {
  return installedResult.manifests;
}

export function directiveCompletionStatus(): Readonly<DirectiveCompletionLoadResult> {
  return installedResult;
}

export function completionSettingsStatus(
  result: DirectiveCompletionLoadResult,
): DirectiveCompletionSettingsStatus {
  return {
    loaded: result.manifests.length,
    warningCount: result.warnings.length,
  };
}

export async function loadDirectiveCompletions(): Promise<DirectiveCompletionLoadResult> {
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return EMPTY_RESULT;
  }
  return invoke<DirectiveCompletionLoadResult>('directive_completions_load');
}

function freezeLoadResult(
  result: DirectiveCompletionLoadResult,
): Readonly<DirectiveCompletionLoadResult> {
  const manifests = result.manifests.map(freezeManifest);
  const warnings = result.warnings.map((warning) => Object.freeze({ ...warning }));
  return Object.freeze({
    directory: result.directory,
    manifests: Object.freeze(manifests),
    warnings: Object.freeze(warnings),
  });
}

function freezeManifest(
  manifest: LoadedDirectiveCompletionManifest,
): Readonly<LoadedDirectiveCompletionManifest> {
  const directives = manifest.directives.map((directive) =>
    Object.freeze({
      ...directive,
      values: Object.freeze([...directive.values]),
    }),
  );
  return Object.freeze({
    ...manifest,
    grammar: Object.freeze({ ...manifest.grammar }),
    directives: Object.freeze(directives),
  });
}
