import { convertPort, dialogPort, fsPort } from '../../platform/index.ts';
import { isSafPath } from '../../lib/saf-fs';
import { baseNameOf, fileNameOf, claimImportName, joinInFolder } from '../../lib/import-plan';
import { convertedMarkdownPath } from '../../lib/convert-conflict';
import type { FilesCtx, OpenPath } from './files-ctx.ts';

export function createConvertOpeners(
  ctx: FilesCtx,
  openPath: OpenPath,
  filePickerStartDir: () => Promise<string | undefined>,
) {
  const { workspace, toasts, t, openConvertedContent } = ctx;

  async function openAndConvert(path: string, ext: string) {
    const fileName = path.split(/[\\/]/).pop() ?? path;
    const tid = toasts.info(`Converting ${fileName} to Markdown…`, 0);
    try {
      const markdown = await convertPort.convertFileToMarkdown({ path });
      toasts.dismiss(tid);
      const targetPath = convertedMarkdownPath(path);
      const opened = await openConvertedContent({
        sourceName: fileName,
        targetPath,
        fileName: fileNameOf(targetPath),
        language: 'markdown',
        content: markdown,
      });
      if (opened) toasts.success(`Converted ${fileName} → Markdown`);
    } catch (e) {
      toasts.dismiss(tid);
      const msg = String(e);
      if (msg.includes('markitdown')) {
        // Show install hint for markitdown-dependent formats
        toasts.warning(
          `Converting .${ext} requires markitdown:\npip install 'markitdown[all]'`,
          8000,
        );
      } else {
        toasts.error(`Conversion failed: ${msg}`);
      }
    }
  }

  /**
   * Import documents — Word / PDF / HTML / spreadsheets / slides / EPUB — as
   * Markdown files in the workspace.
   *
   * The converter has been in the app since v2.x, but the only way to reach it
   * was to open or drag a non-Markdown file and get an unsaved tab back. That
   * is fine for a one-off look and useless for the actual job, which is
   * "I have a folder of Word documents and I want them in my notes": no
   * multi-select, nothing written to disk, and no accounting of what failed.
   *
   * Converted files land in the workspace root as `<original name>.md`. That
   * is a deliberate default rather than a picker — one more dialog per import
   * for a location the user can change afterwards with a drag is not a trade
   * worth making. Without a workspace open there is nowhere to write, so it
   * falls back to the old behaviour and opens unsaved tabs.
   */
  async function importDocuments() {
    const selected = await dialogPort.open({
      multiple: true,
      defaultPath: await filePickerStartDir(),
      filters: [
        {
          name: 'Documents',
          extensions: [
            'docx', 'pdf', 'html', 'htm', 'csv', 'xlsx', 'xls',
            'pptx', 'epub', 'json', 'xml',
          ],
        },
      ],
    });
    const paths = Array.isArray(selected)
      ? selected
      : typeof selected === 'string'
        ? [selected]
        : [];
    if (!paths.length) return;

    const folder = workspace.currentFolder;
    // SAF vaults write through ContentResolver with document ids rather than
    // paths; rather than half-support that here, Android imports open as tabs.
    const writeToDisk = !!folder && !isSafPath(folder);

    // One listing instead of an existence check per file: importing 40
    // documents should not be 40 extra IPC round-trips.
    const taken = new Set<string>();
    if (writeToDisk) {
      try {
        const entries = await fsPort.listDir({ path: folder });
        for (const e of entries) taken.add(e.name.toLowerCase());
      } catch {
        /* an unreadable folder will surface on the first write anyway */
      }
    }

    const imported: string[] = [];
    const failed: Array<{ name: string; error: string }> = [];
    let needsMarkitdown = false;

    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      const fileName = fileNameOf(path);
      // A sticky toast per file (timeout 0, dismissed in `finally`): converting
      // a big PDF takes seconds, and an import that looks like nothing is
      // happening is one the user starts again.
      const progressId = toasts.info(
        t('import.progress', { done: i + 1, total: paths.length, name: fileName }),
        0,
      );
      try {
        const markdown = await convertPort.convertFileToMarkdown({ path });
        const base = baseNameOf(fileName);
        if (writeToDisk) {
          // `claimImportName` is where an existing note is protected — see
          // import-plan.ts. It also reserves the name inside this batch, so
          // importing two `report.*` files produces two notes.
          const target = joinInFolder(folder!, claimImportName(taken, fileName));
          await fsPort.writeFile({ path: target, content: markdown, encoding: 'UTF-8' });
          imported.push(target);
        } else {
          const targetPath = convertedMarkdownPath(path);
          const opened = await openConvertedContent({
            sourceName: fileName,
            targetPath,
            fileName: `${base}.md`,
            language: 'markdown',
            content: markdown,
          });
          if (opened) imported.push(`${base}.md`);
        }
      } catch (e) {
        const msg = String(e);
        if (msg.includes('markitdown')) needsMarkitdown = true;
        failed.push({ name: fileName, error: msg });
      } finally {
        toasts.dismiss(progressId);
      }
    }

    if (imported.length && writeToDisk) {
      window.dispatchEvent(new CustomEvent('solomd:saved', { detail: { filePath: imported[0] } }));
      // Open the first import so the result is visible rather than merely
      // reported — a summary toast alone leaves the user hunting in the tree.
      await openPath(imported[0], { bypassNewWindow: true });
    }

    if (imported.length) {
      toasts.success(
        writeToDisk
          ? t('import.done', { count: imported.length, folder: fileNameOf(folder!) })
          : t('import.doneTabs', { count: imported.length }),
        4000,
      );
    }
    if (needsMarkitdown) {
      toasts.warning(t('import.needsMarkitdown'), 9000);
    }
    if (failed.length) {
      // Naming the files that failed matters more than the stack: the user
      // needs to know which documents did not make it, and re-running an
      // import is cheap.
      toasts.error(
        t('import.failed', {
          count: failed.length,
          names: failed.slice(0, 3).map((f) => f.name).join(', ') + (failed.length > 3 ? '…' : ''),
        }),
        8000,
      );
      console.warn('[import] failures', failed);
    }
  }

  return { openAndConvert, importDocuments };
}
