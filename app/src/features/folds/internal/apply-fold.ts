import type { Extension } from '@codemirror/state';
import type { EditorFeatureContext } from '../../editor/contracts/index.ts';
import {
  foldAllHeadings, foldHeadingsToLevel, headingFoldExtension, toggleHeadingFoldAtCursor, unfoldAllFolds,
} from '../../../lib/cm/heading-fold.ts';

export type FoldAction = 'toggle' | 'all' | 'none' | 'level';

const DEFAULT_FOLD_LEVEL = 2;

export function applyFold(ctx: EditorFeatureContext, action: FoldAction, level = DEFAULT_FOLD_LEVEL): void {
  if (!ctx.settings.foldingEnabled) {
    ctx.toast.info(ctx.t('fold.disabledHint'));
    return;
  }
  const view = ctx.view();
  if (!view) return;
  view.focus();
  if (action === 'toggle') toggleHeadingFoldAtCursor(view);
  else if (action === 'all') foldAllHeadings(view);
  else if (action === 'none') unfoldAllFolds(view);
  else foldHeadingsToLevel(view, level);
}

export function foldExtensionFor(ctx: EditorFeatureContext, on: boolean): Extension {
  if (!on) return [];
  return headingFoldExtension({
    placeholderLabel: (lines) => ctx.t('fold.placeholder', { lines }),
  });
}
