import { EditorView } from '@codemirror/view';
import { spellcheckExtension } from '../../../lib/cm-spellcheck.ts';
import { spellcheckTheme } from '../../../lib/cm-spellcheck-theme.ts';
import type { EditorFeature } from '../../editor/contracts/index.ts';

export function createSpellcheckFeature(): EditorFeature {
  return {
    id: 'spellcheck', settingsKeys: ['spellcheckEnabled'], i18nKeys: [],
    slots: [{
      slot: 'spellcheck-attr',
      deps: (ctx) => ctx.props().spellCheck,
      build: (ctx) => EditorView.contentAttributes.of({ spellcheck: ctx.props().spellCheck ? 'true' : 'false' }),
    }],
    extensions: {
      'md-spellcheck': (ctx) => ctx.tab().language === 'markdown'
        ? [spellcheckExtension({ enabled: () => ctx.settings.spellcheckEnabled }), spellcheckTheme]
        : [],
    },
  };
}
