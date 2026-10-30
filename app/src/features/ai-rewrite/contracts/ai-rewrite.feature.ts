import { IS_APP_STORE_BUILD } from '../../../lib/app-build.ts';
import type { EditorFeature } from '../../editor/contracts/index.ts';
import { legacyAiRewriteAdapter } from '../internal/ai-rewrite.legacy.adapter.ts';
import { aiLockExtension, currentAiRewriteKey } from '../internal/rewrite-key.ts';
import type { AiRewritePort } from './ai-rewrite.port.ts';

export function createAiRewriteFeature(port: AiRewritePort = legacyAiRewriteAdapter): EditorFeature {
  return {
    id: 'ai-rewrite',
    settingsKeys: ['keybindings'],
    i18nKeys: [],
    slots: [
      {
        slot: 'ai-lock',
        deps: (ctx) => port.isLocked(ctx.tab().filePath),
        build: (ctx) => aiLockExtension(port.isLocked(ctx.tab().filePath)),
      },
      {
        slot: 'ai-key',
        when: (ctx) => !IS_APP_STORE_BUILD && ctx.tab().language === 'markdown',
        // #180 — a rebind in Settings reaches the open editor immediately.
        deps: (ctx) => currentAiRewriteKey(ctx.settings.keybindings),
        build: (ctx) => port.extension(currentAiRewriteKey(ctx.settings.keybindings)),
      },
    ],
  };
}
