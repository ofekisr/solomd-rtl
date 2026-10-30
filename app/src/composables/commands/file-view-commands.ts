import { openerPort } from '../../platform/index.ts';
import { requestNewFileInTree } from '../../features/file-tree/contracts/index.ts';
import { useTabsStore } from '../../stores/tabs';
import { useThemeStore } from '../../stores/theme';
import { useGitPaneStore } from '../../stores/gitPane';
import type { Command, CommandCtx } from './command-types.ts';

export function fileViewCommands(ctx: CommandCtx): Command[] {
  const { files, settings, kb, tabs, tiles, toasts, ws } = ctx;
  return [
    { id: 'file.new', title: 'New Markdown File', shortcut: kb('file.new'), run: () => files.newFile() },
    { id: 'file.newText', title: 'New Plain Text File', shortcut: kb('file.newText'), run: () => files.newTextFile() },
    {
      // #338 — create in the folder selected in the file tree (the selected
      // file's folder for a file), named inline like the tree's own ＋. With
      // no folder open there is no tree to name it in, so it is a plain new
      // note.
      id: 'file.newInFolder',
      title: 'New Note in Selected Folder',
      shortcut: kb('file.newInFolder'),
      run: () => {
        if (!ws.currentFolder) return void files.newFile();
        if (!settings.showFileTree) settings.toggleFileTree();
        requestNewFileInTree();
      },
    },
    { id: 'file.open', title: 'Open File…', shortcut: kb('file.open'), run: () => files.openFile() },
    { id: 'file.save', title: 'Save', shortcut: kb('file.save'), run: () => files.saveActive() },
    { id: 'file.saveAs', title: 'Save As…', shortcut: kb('file.saveAs'), run: () => files.saveActiveAs() },
    {
      id: 'file.openFolder',
      title: 'Open Folder…',
      hint: 'Browse files in the sidebar',
      run: () => files.openFolder(),
    },
    { id: 'file.closeTab', title: 'Close Tab', shortcut: kb('file.closeTab'), run: () => tabs.activeId && files.closeTabSafe(tabs.activeId) },

    // v4.0.3 — Open active document in system default editor
    {
      id: 'file.openExternal',
      title: 'Open in External Editor',
      hint: 'Open file with system default editor',
      run: async () => {
        const tab = useTabsStore().activeTab;
        const path = tab?.filePath;
        if (!path) {
          toasts.warning('Save the file first before opening in an external editor');
          return;
        }
        try {
          await openerPort.openPath(path);
        } catch (e) {
          toasts.warning(`Failed: ${e}`);
        }
      },
    },

    { id: 'view.editor', title: 'View: Edit Only', run: () => settings.setViewMode('edit') },
    { id: 'view.split', title: 'View: Split', run: () => settings.setViewMode('split') },
    { id: 'view.preview', title: 'View: Preview Only', run: () => settings.setViewMode('preview') },
    { id: 'view.cycleView', title: 'View: Cycle Mode', shortcut: kb('view.cycleView'), run: () => settings.cycleViewMode() },
    { id: 'view.toggleLiveEdit', title: 'View: Toggle Live Edit / Edit Only', shortcut: kb('view.toggleLiveEdit'), run: () => settings.toggleLiveEditSource() },
    { id: 'view.toggleOutline', title: 'View: Toggle Outline', shortcut: kb('view.toggleOutline'), run: () => { const tabs = useTabsStore(); if (tabs.activeId) tabs.toggleOutline(tabs.activeId); } },
    { id: 'view.toggleFileTree', title: 'View: Toggle File Tree', shortcut: kb('view.toggleFileTree'), run: () => settings.toggleFileTree() },
    { id: 'view.toggleRightSidebar', title: 'View: Toggle Right Sidebar', hint: 'Hide / show the Outline / Backlinks / Tags / History / Agent strip without losing per-pane preferences', shortcut: kb('view.toggleRightSidebar'), run: () => settings.toggleRightSidebar() },
    { id: 'view.toggleAgentPanel', title: 'View: Toggle Agent Panel', hint: 'Right-side chat-with-vault panel — streamed multi-turn AI with tool-call cards, persisted run history, and trace replay', run: () => settings.toggleAgentPanel() },
    { id: 'view.toggleBacklinks', title: 'View: Toggle Backlinks Pane', run: () => settings.toggleBacklinks() },
    { id: 'view.relationships', title: 'View: Toggle Relationships Pane', hint: 'Typed relationships — forward edges authored in YAML front matter plus computed inverses (Referenced by)', run: () => settings.toggleRelationships() },
    { id: 'view.toggleTagsPanel', title: 'View: Toggle Tags Pane', run: () => settings.toggleTagsPanel() },
    {
      id: 'view.toggleTasksPanel',
      title: 'View: Toggle Tasks Pane',
      hint: 'Every unfinished `- [ ]` in this workspace, grouped by file',
      run: () => settings.toggleTasksPanel(),
    },
    { id: 'view.toggleNeighborhood', title: 'View: Toggle Neighborhood Pane', hint: 'Per-note relationship explorer — frontmatter wikilink groups, inverse relationships, and backlinks; click to open, ⌘/Ctrl-click to pivot', run: () => settings.toggleNeighborhood() },
    { id: 'view.toggleTypesPanel', title: 'View: Toggle Types Pane', hint: 'Type-driven sidebar — notes with `type:<Name>` grouped into collapsible first-class sections (types-as-lenses)', run: () => settings.toggleTypesPanel() },
    { id: 'type.create', title: 'Types: New Type…', hint: 'Create a type-definition note (`type: Type`) so its members get a first-class sidebar section', run: () => { if (!settings.showTypesPanel) settings.toggleTypesPanel(); window.dispatchEvent(new CustomEvent('solomd:create-type')); } },
    { id: 'view.toggleHistoryPanel', title: 'View: Toggle History Pane', hint: 'Show / hide the per-note version history pane (does not disable Auto-Git)', run: () => settings.toggleHistoryPanel() },
    { id: 'git.toggleCommit', title: 'Git: Toggle Commit Panel', hint: 'Changed files, commit message, Commit / Commit and Push', shortcut: kb('git.toggleCommit'), run: () => settings.toggleGitCommit() },
    { id: 'git.toggleLog', title: 'Git: Toggle Log', hint: 'Branches, commit graph and commit details in the bottom dock', shortcut: kb('git.toggleLog'), run: () => settings.toggleGitLog() },
    { id: 'git.push', title: 'Git: Push…', hint: 'Push the current branch to its upstream', shortcut: kb('git.push'), run: () => window.dispatchEvent(new CustomEvent('gitpane:open-push')) },
    { id: 'git.update', title: 'Git: Update Project', hint: 'Pull the current branch', shortcut: kb('git.update'), run: () => { void useGitPaneStore().run({ kind: 'pull' }); } },
    { id: 'git.fetch', title: 'Git: Fetch', hint: 'Fetch all remotes', run: () => { void useGitPaneStore().run({ kind: 'fetch' }); } },
    { id: 'view.toggleInspector', title: 'View: Toggle Properties Inspector', shortcut: kb('view.toggleInspector'), hint: 'Edit the active note’s YAML frontmatter as typed properties (text / number / date / status / tags / relation)', run: () => settings.toggleInspector() },
    { id: 'view.resetSidebarPanes', title: 'View: Reset Sidebar Pane Heights', hint: 'Clear stored per-pane heights so the right sidebar returns to even-share flex layout', run: () => settings.clearRightSidebarPaneHeights() },
    { id: 'view.toggleWrap', title: 'View: Toggle Word Wrap', run: () => settings.toggleWordWrap() },
    { id: 'view.toggleLineNumbers', title: 'View: Toggle Line Numbers', run: () => settings.toggleLineNumbers() },
    { id: 'view.toggleTheme', title: 'View: Toggle Theme', run: () => settings.toggleTheme(useThemeStore().mode) },
    { id: 'view.themeStudio', title: 'View: Theme Studio', hint: 'Build a light + dark theme with colour pickers and live preview', run: () => tabs.openThemeStudio() },
    { id: 'view.toggleLivePreview', title: 'View: Toggle Live Preview / Raw Source (Markdown)', run: () => settings.toggleLivePreview() },
    { id: 'view.toggleSpellCheck', title: 'View: Toggle Spell Check', run: () => settings.toggleSpellCheck() },
    { id: 'view.toggleFocusMode', title: 'View: Toggle Focus Mode', run: () => settings.toggleFocusMode() },
    { id: 'view.toggleToolbar', title: 'View: Show / Hide Toolbar Buttons', shortcut: kb('view.toggleToolbar'), run: () => settings.toggleToolbarHidden() },
    { id: 'view.toggleTypewriter', title: 'View: Toggle Typewriter Mode', run: () => settings.toggleTypewriterMode() },

    // ---- Tile layout ----
    { id: 'tile.splitRight', title: 'Split Editor Right', shortcut: kb('tile.splitRight'), run: () => tiles.splitPane(tiles.focusedPaneId, 'horizontal') },
    { id: 'tile.splitDown', title: 'Split Editor Down', shortcut: kb('tile.splitDown'), run: () => tiles.splitPane(tiles.focusedPaneId, 'vertical') },
    { id: 'tile.closePane', title: 'Close Pane', run: () => tiles.closePane(tiles.focusedPaneId) },
    { id: 'tile.focusNext', title: 'Focus Next Pane', shortcut: kb('tile.focusNext'), run: () => tiles.focusNextPane() },
    { id: 'tile.focusPrev', title: 'Focus Previous Pane', shortcut: kb('tile.focusPrev'), run: () => tiles.focusPrevPane() },
  ];
}
