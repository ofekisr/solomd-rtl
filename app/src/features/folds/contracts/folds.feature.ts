import type { EditorView } from '@codemirror/view';
import type { EditorFeature, EditorFeatureContext } from '../../editor/contracts/index.ts';
import { currentFoldRanges, restoreFoldRanges } from '../../../lib/cm-heading-fold.ts';
import { captureFolds, foldRangesFor, recallFolds, rememberFolds } from '../../../lib/fold-memory.ts';
import { applyFold, foldExtensionFor, type FoldAction } from '../internal/apply-fold.ts';

const DEFAULT_FOLD_LEVEL = 2;

export function createFoldsFeature(): EditorFeature {
  let foldKey = '';
  const keyFor = (ctx: EditorFeatureContext): string => ctx.tab().filePath ?? ctx.tab().id;
  const save = (view: EditorView): void => {
    rememberFolds(foldKey, captureFolds(view.state.doc.toString(), currentFoldRanges(view.state)));
  };
  const restore = (ctx: EditorFeatureContext, view: EditorView): void => {
    foldKey = keyFor(ctx);
    const snapshot = ctx.settings.foldingEnabled ? recallFolds(foldKey) : null;
    if (snapshot) restoreFoldRanges(view, foldRangesFor(view.state.doc.toString(), snapshot));
  };
  return {
    id: 'folds',
    settingsKeys: ['foldingEnabled'],
    i18nKeys: ['fold.placeholder', 'fold.disabledHint'],
    setup: (ctx) => { foldKey = keyFor(ctx); },
    slots: [{
      slot: 'fold',
      deps: (ctx) => ctx.settings.foldingEnabled,
      build: (ctx) => foldExtensionFor(ctx, ctx.settings.foldingEnabled),
    }],
    commands: {
      applyFold: (ctx, action, level) =>
        applyFold(ctx, action as FoldAction, level === undefined ? DEFAULT_FOLD_LEVEL : Number(level)),
    },
    onMount: restore,
    beforeTabSwitch: (_ctx, view, ids) => { if (ids.oldId) save(view); },
    onTabSwitch: restore,
    onUnmount: (_ctx, view) => save(view),
  };
}
