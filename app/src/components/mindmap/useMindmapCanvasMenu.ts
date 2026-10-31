import type { MindElixirInstance } from 'mind-elixir';
import { useToastsStore } from '../../stores/toasts';
import { useMindmapWorkbenchStore } from '../../stores/mindmapWorkbench';
import { useI18n } from '../../i18n';
import { fileDraft, nodesDraft, openWorkbench } from '../../composables/mindmap/useMindmapWorkbench';
import { entryKey, TAB_SOURCE_PREFIX, type EntryDraft } from '../../lib/mindmap/workbench';
import { closingMenuItems, hideContextMenu, installMenuGroup, keepMenuTopVisible, type ContextMenuItem, type GroupMenuItem } from '../../lib/mindmap/context-menu';
import { liveData } from './useMindmapCanvasClipboard.ts';

type MenuEntry = { name: string; onclick: () => void };

export interface MenuDeps {
  getMind(): MindElixirInstance | null;
  getHost(): HTMLElement | null;
  sourcePath(): string | undefined;
  sourceLabel(): string;
  selectedNonRootIds(): string[];
  gateItems(): MenuEntry[];
  jumpToSource(): void;
  pinCurrentAsStripRoot(): void;
  showDetails(): void;
  sortSelectedChildren(): void;
  requestNumbering(isNumbered: boolean): void;
  copyNodePath(): Promise<void>;
  copyMap(): Promise<void>;
  pasteMapFromClipboard(): Promise<void>;
  copyNodeStyle(): void;
  pasteNodeStyle(): void;
  styleTemplateMenuItems(): GroupMenuItem[];
  reportingErrors(run: () => Promise<void>): () => void;
  reportingSyncErrors(run: () => void): () => void;
}

export function useMindmapCanvasMenu(deps: MenuDeps) {
  const toasts = useToastsStore();
  const workbench = useMindmapWorkbenchStore();
  const { t } = useI18n();

  function menuDraft(): EntryDraft | null {
    const sourcePath = deps.sourcePath();
    const mind = deps.getMind();
    if (!mind || !sourcePath) return null;
    const ids = deps.selectedNonRootIds();
    if (ids.length === 0) return sourcePath.startsWith(TAB_SOURCE_PREFIX) ? null : fileDraft(sourcePath);
    return nodesDraft(sourcePath, liveData(mind), ids, deps.sourceLabel());
  }

  function toggleWorkbench(): void {
    const draft = menuDraft();
    if (!draft) {
      toasts.info(t('mindmap.workbenchSaveFirst'));
      return;
    }
    const key = entryKey(draft);
    if (workbench.has(key)) {
      workbench.removeKey(key);
      toasts.success(t('mindmap.workbenchRemoved'));
      return;
    }
    const outcome = workbench.add(draft);
    toasts.success(t(outcome === 'updated' ? 'mindmap.workbenchUpdated' : 'mindmap.workbenchAdded'));
  }

  function openWorkbenchFromMenu(): void {
    const draft = menuDraft();
    openWorkbench(draft && !workbench.has(entryKey(draft)) ? draft : undefined);
  }

  function workbenchMenuItems(): MenuEntry[] {
    return [
      { name: t('mindmap.menuAddToWorkbench'), onclick: toggleWorkbench },
      { name: t('mindmap.menuOpenWorkbench'), onclick: openWorkbenchFromMenu },
    ];
  }

  function copyPasteMenuItems(): ContextMenuItem[] {
    return [
      { name: t('mindmap.menuCopyPath'), onclick: deps.reportingErrors(deps.copyNodePath) },
      { name: t('mindmap.menuCopyStyle'), onclick: deps.reportingSyncErrors(deps.copyNodeStyle) },
      { name: t('mindmap.menuPasteStyle'), onclick: deps.reportingSyncErrors(deps.pasteNodeStyle) },
      { name: t('mindmap.menuCopyMap'), onclick: deps.reportingErrors(deps.copyMap) },
      { name: t('mindmap.menuPasteMap'), onclick: deps.reportingErrors(deps.pasteMapFromClipboard) },
    ];
  }

  function extendedItems(): ContextMenuItem[] {
    const hide = () => hideContextMenu(deps.getHost());
    return closingMenuItems([
      ...deps.gateItems(),
      { name: t('mindmap.jumpToSourceMenu'), onclick: deps.jumpToSource },
      { name: t('mindmap.pinStripRoot'), onclick: deps.pinCurrentAsStripRoot },
      { name: t('mindmap.detailsShow'), onclick: deps.showDetails },
      { name: t('mindmap.sortChildrenMenu'), onclick: deps.sortSelectedChildren },
      { name: t('mindmap.numberMenu'), onclick: () => deps.requestNumbering(true) },
      { name: t('mindmap.removeNumbersMenu'), onclick: () => deps.requestNumbering(false) },
      ...workbenchMenuItems(),
    ], hide);
  }

  function installGroups(instance: MindElixirInstance, host: HTMLElement): void {
    const hide = () => hideContextMenu(host);
    installMenuGroup(host, t('mindmap.menuStyleTemplatesGroup'), deps.styleTemplateMenuItems, hide);
    installMenuGroup(host, t('mindmap.menuCopyPasteGroup'), copyPasteMenuItems(), hide);
    instance.bus.addListener('showContextMenu', () => keepMenuTopVisible(host));
  }

  return { extendedItems, installGroups };
}
