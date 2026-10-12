import { mmapPathFor } from './mindmap-format.ts';

export interface XmindTabRef { id: string; filePath?: string; importedFrom?: string }

export type XmindOpenPlan =
  | { kind: 'activate'; tabId: string }
  | { kind: 'open-mmap'; path: string }
  | { kind: 'import' };

export function planXmindOpen(xmindPath: string, tabs: readonly XmindTabRef[], mmapExists: boolean): XmindOpenPlan {
  const imported = tabs.find((t) => t.importedFrom === xmindPath);
  if (imported) return { kind: 'activate', tabId: imported.id };
  const mmapPath = mmapPathFor(xmindPath);
  const opened = tabs.find((t) => t.filePath === mmapPath);
  if (opened) return { kind: 'activate', tabId: opened.id };
  return mmapExists ? { kind: 'open-mmap', path: mmapPath } : { kind: 'import' };
}
