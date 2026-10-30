import { fsPort } from '../../platform/index.ts';
import { fileNameOf } from '../../lib/import-plan';
import { planXmindOpen } from '../../lib/mindmap/xmind-open';
import { MMAP_EXTENSION, mmapPathFor } from '../../lib/mindmap/format';
import { XMIND_TOO_LARGE_ERROR, XMIND_CONTENT_TOO_LARGE_ERROR } from '../../lib/xmind-limits';
import type { FilesCtx, OpenPath } from './files-ctx.ts';

const XMIND_SHEET_WARNING_MS = 8000;
const XMIND_UNREADABLE_MESSAGE = 'not a readable XMind file';
const XMIND_SIZE_ERRORS: readonly string[] = [XMIND_TOO_LARGE_ERROR, XMIND_CONTENT_TOO_LARGE_ERROR];
const xmindImportsInFlight = new Set<string>();

export function createXmindOpener(ctx: FilesCtx, openPath: OpenPath) {
  const { tabs, workspace, toasts, t } = ctx;

  function announceXmindImport(fileName: string, extraSheetCount: number): void {
    toasts.success(`Imported ${fileName} — saving creates a .${MMAP_EXTENSION} file`);
    if (extraSheetCount <= 0) return;
    toasts.warning(
      `${fileName}: only the first sheet was imported (${extraSheetCount} more not imported)`,
      XMIND_SHEET_WARNING_MS,
    );
  }

  function reportXmindFailure(fileName: string, error: string): void {
    const isSizeError = XMIND_SIZE_ERRORS.includes(error);
    if (!isSizeError) console.error('xmind import failed', error);
    toasts.error(`Failed to open ${fileName}: ${isSizeError ? error : XMIND_UNREADABLE_MESSAGE}`);
  }

  async function importXmindTab(path: string, fileName: string): Promise<void> {
    const bytes = new Uint8Array(await fsPort.readBinaryFile({ path }));
    const { convertXmind } = await import('../../lib/xmind-import');
    const result = await convertXmind(bytes, fileName);
    if (!result.ok) {
      reportXmindFailure(fileName, result.error);
      return;
    }
    const tab = tabs.newTab({ fileName: fileNameOf(mmapPathFor(path)), language: 'mindmap', importedFrom: path });
    tabs.setContent(tab.id, result.text);
    workspace.pushRecent(path);
    announceXmindImport(fileName, result.extraSheetCount);
  }

  async function sidecarMmapExists(path: string): Promise<boolean> {
    try {
      return await fsPort.fsFileExists({ path: mmapPathFor(path) });
    } catch {
      return false;
    }
  }

  async function openXmind(path: string): Promise<void> {
    const plan = planXmindOpen(path, tabs.tabs, await sidecarMmapExists(path));
    if (plan.kind === 'activate') {
      tabs.activate(plan.tabId);
      return;
    }
    if (plan.kind === 'open-mmap') {
      await openPath(plan.path, { bypassNewWindow: true });
      toasts.info(t('mindmap.openedExistingMmap', { name: fileNameOf(plan.path) }));
      return;
    }
    if (xmindImportsInFlight.has(path)) return;
    xmindImportsInFlight.add(path);
    const fileName = fileNameOf(path);
    try {
      await importXmindTab(path, fileName);
    } catch (e) {
      console.error('xmind import failed', e);
      toasts.error(`Failed to open ${fileName}: ${XMIND_UNREADABLE_MESSAGE}`);
    } finally {
      xmindImportsInFlight.delete(path);
    }
  }

  return openXmind;
}
