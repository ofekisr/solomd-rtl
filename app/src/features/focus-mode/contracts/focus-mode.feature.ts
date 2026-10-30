import { focusModeExtension, typewriterModeExtension } from '../../../lib/cm/focus-mode.ts';
import type { EditorFeature } from '../../editor/contracts/index.ts';

export function createFocusModeFeature(): EditorFeature {
  return {
    id: 'focus-mode', settingsKeys: [], i18nKeys: [],
    slots: [
      { slot: 'focus', deps: (ctx) => ctx.props().focusMode, build: (ctx) => (ctx.props().focusMode ? focusModeExtension() : []) },
      { slot: 'typewriter', deps: (ctx) => ctx.props().typewriterMode, build: (ctx) => (ctx.props().typewriterMode ? typewriterModeExtension() : []) },
    ],
  };
}
