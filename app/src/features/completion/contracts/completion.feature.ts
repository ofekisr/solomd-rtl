import { autocompletion } from '@codemirror/autocomplete';
import { citationCompleteSource, citationsExtension } from '../../../lib/cm-citations.ts';
import { directiveCompletionExtension, directiveCompletionSource } from '../../../lib/cm-directive-completions.ts';
import { fenceLanguageComplete, fenceLanguageExtension } from '../../../lib/cm-fence-completion.ts';
import { tagAutocompleteExtension, tagComplete } from '../../../lib/cm-tag-autocomplete.ts';
import { wikilinkComplete, wikilinkExtension } from '../../../lib/cm-wikilink.ts';
import type { EditorFeature } from '../../editor/contracts/index.ts';
import { slashExt } from '../internal/slash.ts';

export function createCompletionFeature(): EditorFeature {
  return {
    id: 'completion',
    settingsKeys: ['slashCommandsEnabled', 'workspaceBibliography'],
    i18nKeys: ['slashCommands.labels.*', 'slashCommands.hints.*', 'slashCommands.empty'],
    extensions: {
      'md-completion': (ctx) => ctx.tab().language !== 'markdown' ? [] : [
        wikilinkExtension(),
        tagAutocompleteExtension(),
        citationsExtension(() => ctx.citations()),
        // #297 — opens itself on the third backtick of a fence opener.
        fenceLanguageExtension(),
        directiveCompletionExtension(),
        // Single autocompletion config combining all markdown sources.
        // CM6 disallows multiple `autocompletion({ override })` extensions.
        autocompletion({
          override: [
            wikilinkComplete,
            tagComplete,
            citationCompleteSource(() => ctx.citations()),
            fenceLanguageComplete,
            directiveCompletionSource,
          ],
          defaultKeymap: true,
          // Typing-triggered completion is the last remaining source of
          // IME-hostile churn here. Keep the sources available for explicit
          // invocation, but do not wake them up on every keystroke.
          // Targeted extensions above wake only their own completion syntax.
          activateOnTyping: false,
        }),
      ],
    },
    slots: [{
      slot: 'slash',
      when: (ctx) => ctx.tab().language === 'markdown',
      deps: (ctx) => ctx.settings.slashCommandsEnabled,
      build: (ctx) => slashExt(ctx),
    }],
  };
}
