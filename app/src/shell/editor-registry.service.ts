import {
  createAppearanceFeature,
  createCoreFeature,
  createEditorFeatureRegistry,
  createLiveRenderFeature,
  type EditorFeature,
  type EditorFeatureRegistry,
} from '../features/editor/contracts/index.ts';
import { createFindFeature } from '../features/find/contracts/index.ts';
import { createVimFeature } from '../features/vim/contracts/index.ts';
import { createSpellcheckFeature } from '../features/spellcheck/contracts/index.ts';
import { createAiRewriteFeature } from '../features/ai-rewrite/contracts/index.ts';
import { createFocusModeFeature } from '../features/focus-mode/contracts/index.ts';
import { createImageUploadFeature } from '../features/image-upload/contracts/index.ts';
import { createCompletionFeature } from '../features/completion/contracts/index.ts';
import { createSessionFeature } from '../features/session/contracts/index.ts';
import { createFoldsFeature } from '../features/folds/contracts/index.ts';
import { createFormatFeature } from '../features/format/contracts/index.ts';

/** Factories, so per-instance feature state (fold key, caret memory) is never shared between split panes.
 *  List order = lifecycle-hook order (setup, onMount, tab switch, unmount). Extension order comes from slots.
 *  Session precedes folds: restore order is session, then folds. */
export const EDITOR_FEATURE_FACTORIES: ReadonlyArray<() => EditorFeature> = [
  createCoreFeature,
  createAppearanceFeature,
  createLiveRenderFeature,
  createFindFeature,
  createVimFeature,
  createSpellcheckFeature,
  createAiRewriteFeature,
  createFocusModeFeature,
  createImageUploadFeature,
  createCompletionFeature,
  createSessionFeature,
  createFoldsFeature,
  createFormatFeature,
];

export function createEditorRegistry(): EditorFeatureRegistry {
  return createEditorFeatureRegistry(EDITOR_FEATURE_FACTORIES.map((create) => create()));
}
