import type { EditorFeature } from '../../editor/contracts/index.ts';
import { clearSession, sessionRestoreExtension } from '../../../lib/cm-session-restore.ts';
import { maybeRestoreSession } from '../internal/restore-session.ts';

export function createSessionFeature(): EditorFeature {
  return {
    id: 'session',
    settingsKeys: [],
    i18nKeys: [],
    extensions: { session: (ctx) => sessionRestoreExtension(ctx.tab().id) },
    watches: [{
      deps: (ctx) => [ctx.tab().content, ctx.tab().savedContent] as const,
      run: (ctx) => { if (ctx.tab().content === ctx.tab().savedContent) clearSession(ctx.tab().id); },
    }],
    onMount: (ctx, view) => maybeRestoreSession(ctx, view),
    onTabSwitch: (ctx, view) => maybeRestoreSession(ctx, view),
  };
}
