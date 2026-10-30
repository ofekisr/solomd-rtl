import { vim } from '@replit/codemirror-vim';
import type { EditorFeature } from '../../editor/contracts/index.ts';
import { registerVimExOnce } from '../internal/vim-ex.ts';

export function createVimFeature(): EditorFeature {
  return {
    id: 'vim', settingsKeys: ['vimMode'], i18nKeys: [],
    slots: [{ slot: 'vim', deps: (ctx) => ctx.settings.vimMode, build: (ctx) => (ctx.settings.vimMode ? vim() : []) }],
    setup: () => { registerVimExOnce(); },
  };
}
