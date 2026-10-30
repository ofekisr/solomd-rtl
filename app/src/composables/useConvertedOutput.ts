import { fsPort } from '../platform/index.ts';
import { useTabsStore } from '../stores/tabs';
import { useSettingsStore } from '../stores/settings';
import { askConvertConflict } from './useConvertConflict';
import { settingAfterAnswer, type ConvertConflictChoice } from '../lib/convert-conflict';
import type { Language, Tab } from '../types';

export interface ConvertedOutput {
  sourceName: string;
  targetPath: string | null;
  fileName: string;
  language: Language;
  content: string;
  importedFrom?: string;
}

const UTF8 = 'UTF-8';

export function useConvertedOutput() {
  const tabs = useTabsStore();
  const settings = useSettingsStore();

  async function fileExists(path: string): Promise<boolean> {
    try {
      return await fsPort.fsFileExists({ path });
    } catch {
      return false;
    }
  }

  async function resolveChoice(sourceName: string, targetName: string): Promise<ConvertConflictChoice> {
    if (settings.convertConflictChoice !== 'ask') return settings.convertConflictChoice;
    const answer = await askConvertConflict(sourceName, targetName);
    settings.setConvertConflictChoice(settingAfterAnswer(answer.choice, answer.shouldRemember, settings.convertConflictChoice));
    return answer.choice;
  }

  async function replaceTarget(output: ConvertedOutput, targetPath: string, open: Tab | undefined): Promise<Tab> {
    await fsPort.writeFile({ path: targetPath, content: output.content, encoding: open?.encoding || UTF8 });
    if (!open) return tabs.openFromDisk({ filePath: targetPath, content: output.content, encoding: UTF8, language: output.language, hadBom: false });
    tabs.applyExternalSave(open.id, output.content);
    tabs.activate(open.id);
    return open;
  }

  async function openExisting(targetPath: string, open: Tab | undefined): Promise<Tab> {
    if (open) {
      tabs.activate(open.id);
      return open;
    }
    const read = await fsPort.readFile({ path: targetPath });
    return tabs.openFromDisk({ filePath: targetPath, content: read.content, encoding: read.encoding, language: read.language, hadBom: read.had_bom });
  }

  function openUntitled(output: ConvertedOutput): Tab {
    const tab = tabs.newTab({ fileName: output.fileName, language: output.language, importedFrom: output.importedFrom });
    tabs.setContent(tab.id, output.content);
    return tab;
  }

  async function openConvertedContent(output: ConvertedOutput): Promise<Tab | null> {
    const targetPath = output.targetPath;
    if (!targetPath) return openUntitled(output);
    const open = tabs.tabs.find((t) => t.filePath === targetPath);
    if (!open && !(await fileExists(targetPath))) return openUntitled(output);
    const choice = await resolveChoice(output.sourceName, output.fileName);
    if (choice === 'replace') return replaceTarget(output, targetPath, open);
    if (choice === 'keep') return openExisting(targetPath, open);
    return null;
  }

  return { openConvertedContent };
}
