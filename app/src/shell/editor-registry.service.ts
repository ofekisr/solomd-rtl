import {
  createEditorFeatureRegistry,
  type EditorFeature,
  type EditorFeatureRegistry,
} from '../features/editor/contracts/index.ts';

/** Factories, so per-instance feature state (fold key, caret memory) is never shared between split panes.
 *  List order = lifecycle-hook order (setup, onMount, tab switch, unmount). Extension order comes from slots. */
export const EDITOR_FEATURE_FACTORIES: ReadonlyArray<() => EditorFeature> = [];

export function createEditorRegistry(): EditorFeatureRegistry {
  return createEditorFeatureRegistry(EDITOR_FEATURE_FACTORIES.map((create) => create()));
}
