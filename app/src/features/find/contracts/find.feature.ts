import { openSearchPanel, search } from '@codemirror/search';
import { createFindPanel } from '../internal/cm-find-panel.ts';
import type { EditorFeature } from '../../editor/contracts/index.ts';
import { incrementalFindScroll } from '../internal/incremental-find.ts';

export function createFindFeature(): EditorFeature {
  return {
    id: 'find', settingsKeys: [], i18nKeys: [],
    extensions: {
      search: (ctx) => [search({ top: true, createPanel: createFindPanel(() => ctx.tab().filePath) }), incrementalFindScroll],
    },
    commands: {
      openFind: (ctx) => { const view = ctx.view(); if (view) { view.focus(); openSearchPanel(view); } },
    },
  };
}
