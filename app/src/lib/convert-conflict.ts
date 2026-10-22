export type ConvertConflictChoice = 'replace' | 'keep' | 'cancel';
export type RememberedConvertChoice = Exclude<ConvertConflictChoice, 'cancel'>;
export type ConvertConflictSetting = 'ask' | RememberedConvertChoice;

const SETTINGS: readonly ConvertConflictSetting[] = ['ask', 'replace', 'keep'];
export const DEFAULT_CONVERT_CONFLICT_SETTING: ConvertConflictSetting = 'ask';

export function normalizeConvertConflictSetting(value: unknown): ConvertConflictSetting {
  return SETTINGS.includes(value as ConvertConflictSetting) ? (value as ConvertConflictSetting) : DEFAULT_CONVERT_CONFLICT_SETTING;
}

export function convertedMarkdownPath(sourcePath: string): string {
  const slash = Math.max(sourcePath.lastIndexOf('/'), sourcePath.lastIndexOf('\\'));
  const dot = sourcePath.lastIndexOf('.');
  const stem = dot > slash + 1 ? sourcePath.slice(0, dot) : sourcePath;
  return `${stem}.md`;
}

export function settingAfterAnswer(choice: ConvertConflictChoice, shouldRemember: boolean, current: ConvertConflictSetting): ConvertConflictSetting {
  if (!shouldRemember || choice === 'cancel') return current;
  return choice;
}

export function siblingPath(sourcePath: string, fileName: string): string {
  const slash = Math.max(sourcePath.lastIndexOf('/'), sourcePath.lastIndexOf('\\'));
  return slash < 0 ? fileName : sourcePath.slice(0, slash + 1) + fileName;
}
