import { z } from 'zod';
import type { SettingsSlice } from '../../contracts/index.ts';

export type WritingSettings = {
  // Editor super features
  spellCheck: boolean;
  focusMode: boolean;
  typewriterMode: boolean;
  vimMode: boolean;
  /** Windows only: 'native' textarea (IME-safe, default) or 'codemirror'
   *  (syntax highlighting, non-jumping live edit) — #328, #344. Vim mode
   *  forces CodeMirror regardless. Ignored on other platforms. */
  windowsEditorEngine: 'native' | 'codemirror';
  // v2.0 F2: CodeMirror Hunspell spell-check (separate from browser-native `spellCheck` above).
  spellcheckEnabled: boolean;
  // v2.5 F2: writing stats — show the per-doc word/char goal pill in the
  // status bar. Off-by-default-ish: the pill stays inert unless the doc's
  // YAML front matter sets a `goal:` key, so this toggle is a hard kill
  // switch for the whole feature rather than a daily-use opt-in.
  showWritingStats: boolean;
  // v2.5 F2: optional "Today: 1,200 words across 3 docs" bauble in the bottom
  // right of the status bar. Stretch goal — defaults off because most users
  // care about per-doc progress, not workspace-wide.
  showWorkspaceDailyTotal: boolean;
  // v2.5 F4: Pomodoro / focus session timer.
  pomodoroShowControls: boolean;
  pomodoroAutoEngageFocus: boolean;
  pomodoroDefaultMinutes: 25 | 50 | 90 | number;
  // v2.5 F7: Affine/Notion-style "/" slash command popup in the markdown
  // editor. Default ON — can be turned off for users who don't like
  // the keyboard interception.
  slashCommandsEnabled: boolean;
  // #246 — Hunspell dictionary to load. Only en_US ships with the app; any
  // `<code>.aff`/`.dic` pair the user drops into `<config>/dictionaries/`
  // becomes selectable. Kept separate from the UI `language` setting: people
  // routinely run an English interface while writing Spanish.
  spellcheckLang: string;
};

const schema = z.object({
  spellCheck: z.boolean(),
  focusMode: z.boolean(),
  typewriterMode: z.boolean(),
  vimMode: z.boolean(),
  windowsEditorEngine: z.enum(['native', 'codemirror']),
  spellcheckEnabled: z.boolean(),
  showWritingStats: z.boolean(),
  showWorkspaceDailyTotal: z.boolean(),
  pomodoroShowControls: z.boolean(),
  pomodoroAutoEngageFocus: z.boolean(),
  pomodoroDefaultMinutes: z.number(),
  slashCommandsEnabled: z.boolean(),
  spellcheckLang: z.string(),
});

function defaults(): WritingSettings {
  return {
    spellCheck: true,
    focusMode: false,
    typewriterMode: false,
    vimMode: false,
    windowsEditorEngine: 'native',
    spellcheckEnabled: false,
    showWritingStats: true,
    showWorkspaceDailyTotal: false,
    pomodoroShowControls: true,
    pomodoroAutoEngageFocus: true,
    pomodoroDefaultMinutes: 25,
    slashCommandsEnabled: true,
    spellcheckLang: 'en_US',
  };
}

export const writingSlice: SettingsSlice<WritingSettings> = {
  id: 'writing',
  schema,
  defaults,
  normalize(_parsed, merged) {
    if (merged.windowsEditorEngine !== 'codemirror') merged.windowsEditorEngine = 'native';
  },
};
