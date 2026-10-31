import { KEY_ACTIONS } from '../../lib/keybindings';
import { runActiveMindmapAction } from '../../lib/mindmap/active';
import { MINDMAP_WORKBENCH_ACTION, openWorkbench } from '../mindmap/useMindmapWorkbench';
import { MINDMAP_CONVERT_ACTIONS, MINDMAP_CONVERT_EVENT, MINDMAP_CONVERT_FOLDER_ACTION, MINDMAP_CONVERT_FOLDER_EVENT, MINDMAP_FOLDER_TREE_ACTION, MINDMAP_FOLDER_TREE_EVENT, type MindmapConvertDetail } from '../mindmap/useMindmapConvert';
import type { Command, CommandCtx } from './command-types.ts';

export function mindmapCommandList(ctx: CommandCtx): Command[] {
  const { kb, tiles, toasts, t } = ctx;

  const MINDMAP_CATEGORY = 'mindmap';
  const MINDMAP_ID_PREFIX = 'mindmap.';
  const mindmapCommands: Command[] = KEY_ACTIONS.filter((a) => a.category === MINDMAP_CATEGORY).map((a) => ({
    id: a.id,
    title: a.label,
    shortcut: kb(a.id),
    run: () => { if (!runActiveMindmapAction(a.id)) toasts.info(t('mindmap.noActiveMap')); },
  }));

  const mindmapConvertCommands: Command[] = Object.entries(MINDMAP_CONVERT_ACTIONS).map(([id, { scope, output }]) => ({
    id,
    title: t(`cmd.mindmap.${id.slice(MINDMAP_ID_PREFIX.length)}`),
    shortcut: kb(id),
    run: () => {
      const detail: MindmapConvertDetail = { scope, output, paneId: tiles.focusedPaneId };
      window.dispatchEvent(new CustomEvent(MINDMAP_CONVERT_EVENT, { detail }));
    },
  }));

  const mindmapWorkbenchCommand: Command = {
    id: MINDMAP_WORKBENCH_ACTION,
    title: t('cmd.mindmap.workbench'),
    shortcut: kb(MINDMAP_WORKBENCH_ACTION),
    run: () => openWorkbench(),
  };
  const mindmapFolderCommand: Command = {
    id: MINDMAP_CONVERT_FOLDER_ACTION,
    title: t('cmd.mindmap.convertFolder'),
    shortcut: kb(MINDMAP_CONVERT_FOLDER_ACTION),
    run: () => { window.dispatchEvent(new CustomEvent(MINDMAP_CONVERT_FOLDER_EVENT)); },
  };

  const mindmapFolderTreeCommand: Command = {
    id: MINDMAP_FOLDER_TREE_ACTION,
    title: t('cmd.mindmap.folderTree'),
    shortcut: kb(MINDMAP_FOLDER_TREE_ACTION),
    run: () => { window.dispatchEvent(new CustomEvent(MINDMAP_FOLDER_TREE_EVENT)); },
  };

  return [...mindmapCommands, ...mindmapConvertCommands, mindmapFolderCommand, mindmapFolderTreeCommand, mindmapWorkbenchCommand];
}
