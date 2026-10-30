import type { Extension } from '@codemirror/state';
import { slashCommandsExtension, type SlashCommandsConfig } from '../../../lib/cm-slash-commands.ts';
import type { EditorFeatureContext } from '../../editor/contracts/index.ts';

const I18N_ECHO_PREFIX = 'slashCommands.';

function translatedOrUndefined(ctx: EditorFeatureContext, key: string): string | undefined {
  const value = ctx.t(key);
  return value.startsWith(I18N_ECHO_PREFIX) ? undefined : value;
}

export function slashOptions(ctx: EditorFeatureContext): SlashCommandsConfig {
  return {
    enabled: () => ctx.settings.slashCommandsEnabled,
    labelFor: (id) => translatedOrUndefined(ctx, `slashCommands.labels.${id}`),
    hintFor: (id) => translatedOrUndefined(ctx, `slashCommands.hints.${id}`),
    emptyHint: (q) => ctx.t('slashCommands.empty', { query: q }),
  };
}

export function slashExt(ctx: EditorFeatureContext): Extension {
  if (!ctx.settings.slashCommandsEnabled) return [];
  return slashCommandsExtension(slashOptions(ctx));
}
