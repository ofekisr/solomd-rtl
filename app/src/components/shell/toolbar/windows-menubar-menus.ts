import type { MenubarName } from './useToolbarDropdowns.ts';

export type MenubarEntry = { id: string; label: string; shortcut?: string } | { sep: true };

type Translate = (key: string) => string;
type ChordOf = (actionId: string) => string;

/**
 * Item ids mirror runner.rs's native menu ids; App.vue's `dispatchMenuAction`
 * handles both. Shortcut labels show what the JS handlers (useShortcuts.ts)
 * bind on Windows, not the old native accelerators.
 */
export function buildMenubarMenus(t: Translate, chord: ChordOf): Record<MenubarName, MenubarEntry[]> {
  return {
    file: [
      { id: 'file.new', label: t('menubar.newMd'), shortcut: chord('file.new') },
      { id: 'file.newText', label: t('menubar.newText'), shortcut: chord('file.newText') },
      { sep: true },
      { id: 'file.open', label: t('menubar.openFile'), shortcut: chord('file.open') },
      { id: 'file.openFolder', label: t('menubar.openFolder') },
      { id: 'file.import', label: t('menubar.importDocs'), shortcut: chord('file.import') },
      { sep: true },
      { id: 'file.save', label: t('menubar.save'), shortcut: chord('file.save') },
      { id: 'file.saveAs', label: t('menubar.saveAs'), shortcut: chord('file.saveAs') },
      { sep: true },
      { id: 'file.openExternal', label: t('menubar.openExternal'), shortcut: chord('file.openExternal') },
      { sep: true },
      { id: 'file.print', label: t('menubar.print'), shortcut: chord('export.pdfPrint') },
      { sep: true },
      { id: 'window.new', label: t('menubar.newWindow'), shortcut: chord('window.new') },
      { id: 'file.closeTab', label: t('menubar.closeTab'), shortcut: chord('file.closeTab') },
      { sep: true },
      // #221 — parity with the removed native menu's quit item. Now rebindable via Settings (#ctrlq).
      { id: 'file.exit', label: t('menubar.exit'), shortcut: chord('file.exit') || 'Alt+F4' },
    ],
    edit: [
      { id: 'edit.undo', label: t('menubar.undo'), shortcut: 'Ctrl+Z' },
      { id: 'edit.redo', label: t('menubar.redo'), shortcut: 'Ctrl+Y' },
      { sep: true },
      { id: 'edit.cut', label: t('menubar.cut'), shortcut: 'Ctrl+X' },
      { id: 'edit.copy', label: t('menubar.copy'), shortcut: 'Ctrl+C' },
      { id: 'edit.paste', label: t('menubar.paste'), shortcut: 'Ctrl+V' },
      { sep: true },
      { id: 'edit.selectAll', label: t('menubar.selectAll'), shortcut: 'Ctrl+A' },
    ],
    view: [
      { id: 'view.toggleTheme', label: t('menubar.toggleTheme') },
      { sep: true },
      { id: 'view.toggleFileTree', label: t('menubar.toggleFileTree'), shortcut: chord('view.toggleFileTree') },
      { id: 'view.toggleOutline', label: t('menubar.toggleOutline'), shortcut: chord('view.toggleOutline') },
      { id: 'view.cycleView', label: t('menubar.cycleView'), shortcut: chord('view.cycleView') },
      { sep: true },
      { id: 'view.zoomUiIn', label: t('menubar.uiZoomIn'), shortcut: 'Ctrl+=' },
      { id: 'view.zoomUiOut', label: t('menubar.uiZoomOut'), shortcut: 'Ctrl+-' },
      { id: 'view.zoomUiReset', label: t('menubar.uiZoomReset'), shortcut: 'Ctrl+0' },
      { sep: true },
      { id: 'view.zoomEditorIn', label: t('menubar.editorZoomIn'), shortcut: 'Ctrl+Shift+=' },
      { id: 'view.zoomEditorOut', label: t('menubar.editorZoomOut'), shortcut: 'Ctrl+Shift+-' },
      { id: 'view.zoomEditorReset', label: t('menubar.editorZoomReset'), shortcut: 'Ctrl+Shift+0' },
      { sep: true },
      { id: 'view.zoomPreviewIn', label: t('menubar.previewZoomIn') },
      { id: 'view.zoomPreviewOut', label: t('menubar.previewZoomOut') },
      { id: 'view.zoomPreviewReset', label: t('menubar.previewZoomReset') },
      { sep: true },
      { id: 'view.cmdPalette', label: t('menubar.palette'), shortcut: chord('palette.open') },
      { id: 'search.global', label: t('menubar.globalSearch'), shortcut: chord('search.global') },
      { sep: true },
      { id: 'view.settings', label: t('menubar.settings'), shortcut: 'Ctrl+,' },
    ],
    help: [
      { id: 'help.markdown', label: t('menubar.mdHelp'), shortcut: chord('help.markdown') },
      { sep: true },
      { id: 'help.about', label: t('menubar.about') },
    ],
  };
}
