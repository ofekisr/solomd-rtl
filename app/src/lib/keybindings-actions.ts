export type KeyCombo = string;

export type KeyScope = 'global' | 'mindmap' | 'gitCommit';

export interface KeyActionDef {
  /** Stable id — matches the command registry's id where one exists. */
  id: string;
  /** Name shown in Settings. English, like the command palette's titles. */
  label: string;
  category: 'file' | 'edit' | 'view' | 'navigate' | 'tools' | 'mindmap';
  /**
   * Defaults, in priority order. A few actions ship two chords — ⌘N and ⌘T
   * both make a note, F1 and ⌘/ both open help — because both are muscle
   * memory from different editors. A user binding replaces the whole set.
   */
  defaults: KeyCombo[];
  /**
   * Platforms this action exists on. Omitted means all of them, which is the
   * case for everything except `file.exit` — see its entry.
   */
  platforms?: ('mac' | 'windows' | 'linux')[];
  /** Where the chord is live. Omitted means everywhere (the window dispatcher). */
  scope?: KeyScope;
}

export function scopeOf(action: KeyActionDef): KeyScope {
  return action.scope ?? 'global';
}

/** Which platform's key table to build. Overridable so tests can pin one. */
export function currentPlatform(): 'mac' | 'windows' | 'linux' {
  // `?forcePlatform=windows` is a dev-only QA hook, the same idea as
  // `?forcePlain` / `?forceWinChrome`: it lets the Windows-only parts of the
  // shortcut panel be driven from a macOS dev build. The Tauri shell has no
  // URL bar, so it is inert for real users.
  if (typeof location !== 'undefined') {
    const forced = /[?&]forcePlatform=(mac|windows|linux)\b/.exec(location.search);
    if (forced) return forced[1] as 'mac' | 'windows' | 'linux';
  }
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/Mac|iPhone|iPad/.test(ua)) return 'mac';
  if (/Win/.test(ua)) return 'windows';
  return 'linux';
}

/** The actions bindable on this platform. Every consumer iterates this, not
 *  `KEY_ACTIONS`, so a platform-gated action never reaches the settings list,
 *  the resolver, or the conflict check. */
export function activeKeyActions(
  platform: 'mac' | 'windows' | 'linux' = currentPlatform(),
): KeyActionDef[] {
  return KEY_ACTIONS.filter((a) => !a.platforms || a.platforms.includes(platform));
}

/**
 * Every app-level shortcut, transcribed from the pre-#180 handler so the
 * defaults are byte-for-byte what shipped before.
 */
export const KEY_ACTIONS: KeyActionDef[] = [
  // ---- File ----
  { id: 'file.new', label: 'New Note', category: 'file', defaults: ['Mod+N', 'Mod+T'] },
  { id: 'file.newText', label: 'New Plain Text File', category: 'file', defaults: ['Mod+Alt+N'] },
  // #338 — a note in the folder selected in the file tree (or the selected
  // file's folder). No native menu item carries it, so it needs no entry in
  // MENU_ITEM_BY_ACTION.
  { id: 'file.newInFolder', label: 'New Note in Selected Folder', category: 'file', defaults: ['Mod+Alt+Shift+N'] },
  { id: 'file.open', label: 'Open File…', category: 'file', defaults: ['Mod+O'] },
  { id: 'file.import', label: 'Import Documents…', category: 'file', defaults: ['Mod+Shift+L'] },
  { id: 'file.save', label: 'Save', category: 'file', defaults: ['Mod+S'] },
  { id: 'file.saveAs', label: 'Save As…', category: 'file', defaults: ['Mod+Shift+S'] },
  { id: 'file.closeTab', label: 'Close Tab', category: 'file', defaults: ['Mod+W'] },
  { id: 'file.openExternal', label: 'Open in External Editor', category: 'file', defaults: ['Mod+Shift+E'] },
  { id: 'window.new', label: 'New Window', category: 'file', defaults: ['Mod+Shift+N'] },
  // #272 — not on macOS: Quit ⌘Q belongs to the OS app menu, and the native
  // Exit item is built `#[cfg(target_os = "linux")]`, so a rebind here could
  // never reach the menu that actually owns the chord. Listing it in Settings
  // would be the exact lie #180 set out to remove.
  {
    id: 'file.exit',
    label: 'Exit',
    category: 'file',
    defaults: ['Mod+Q'],
    platforms: ['windows', 'linux'],
  },

  // ---- Edit ----
  { id: 'editor.caseCycle', label: 'Cycle Case of Selection', category: 'edit', defaults: ['Shift+F3'] },
  // ---- Formatting (#296, #274) ----
  // Bold is NOT on Mod+B by default: that has toggled the file tree since
  // 1.0 (the VS Code habit), and taking it away from everyone to match the
  // Typora habit trades one group's muscle memory for another's. The writer
  // preset below swaps the two in one click instead.
  { id: 'fmt.bold', label: 'Bold', category: 'edit', defaults: ['Mod+Shift+B'] },
  { id: 'fmt.italic', label: 'Italic', category: 'edit', defaults: ['Mod+I'] },
  { id: 'fmt.strike', label: 'Strikethrough', category: 'edit', defaults: ['Mod+Shift+X'] },
  { id: 'fmt.code', label: 'Inline Code', category: 'edit', defaults: ['Mod+Shift+M'] },
  { id: 'fmt.link', label: 'Link', category: 'edit', defaults: ['Mod+K'] },
  { id: 'fmt.h1', label: 'Heading 1', category: 'edit', defaults: ['Mod+1'] },
  { id: 'fmt.h2', label: 'Heading 2', category: 'edit', defaults: ['Mod+2'] },
  { id: 'fmt.h3', label: 'Heading 3', category: 'edit', defaults: ['Mod+3'] },
  { id: 'fmt.h4', label: 'Heading 4', category: 'edit', defaults: ['Mod+4'] },
  { id: 'fmt.h5', label: 'Heading 5', category: 'edit', defaults: ['Mod+5'] },
  { id: 'fmt.h6', label: 'Heading 6', category: 'edit', defaults: ['Mod+6'] },
  { id: 'fmt.quote', label: 'Blockquote', category: 'edit', defaults: ['Mod+Alt+Q'] },
  { id: 'fmt.ul', label: 'Bulleted List', category: 'edit', defaults: ['Mod+Alt+8'] },
  { id: 'fmt.ol', label: 'Numbered List', category: 'edit', defaults: ['Mod+Alt+7'] },
  { id: 'fmt.task', label: 'Task List', category: 'edit', defaults: ['Mod+Alt+9'] },
  { id: 'fmt.codeblock', label: 'Code Block', category: 'edit', defaults: ['Mod+Alt+K'] },
  { id: 'format.markdown', label: 'Format Markdown', category: 'edit', defaults: ['Mod+Alt+L'] },
  { id: 'editor.tableEditor', label: 'Edit Table as Grid', category: 'edit', defaults: ['Mod+Alt+T'] },
  { id: 'editor.formulaEditor', label: 'Edit Formula', category: 'edit', defaults: ['Mod+Alt+M'] },
  { id: 'editor.aiRewrite', label: 'AI Rewrite Selection', category: 'edit', defaults: ['Mod+J'] },
  { id: 'export.copyHtml', label: 'Copy as HTML', category: 'edit', defaults: ['Mod+Shift+C'] },
  { id: 'export.copyMd', label: 'Copy as Markdown', category: 'edit', defaults: ['Mod+Alt+C'] },
  { id: 'export.pdfPrint', label: 'Print / PDF', category: 'edit', defaults: ['Mod+Alt+Shift+P'] },

  // ---- View ----
  { id: 'view.cycleView', label: 'Cycle Edit / Split / Preview', category: 'view', defaults: ['Mod+Shift+P'] },
  // #180: Typora users flip source <-> WYSIWYG with Ctrl+/. That chord is
  // Markdown Help here, so the default is Mod+Alt+/; rebind it to Mod+/ in
  // Settings -> Shortcuts to get Typora's muscle memory back.
  { id: 'view.toggleLiveEdit', label: 'Toggle Live Edit / Edit Only', category: 'view', defaults: ['Mod+Alt+Slash'] },
  { id: 'view.toggleReading', label: 'Toggle Reading Mode', category: 'view', defaults: ['Mod+Shift+R'] },
  { id: 'view.toggleFileTree', label: 'Toggle File Tree', category: 'view', defaults: ['Mod+B'] },
  { id: 'view.toggleRightSidebar', label: 'Toggle Right Sidebar', category: 'view', defaults: ['Mod+Alt+B'] },
  { id: 'view.toggleOutline', label: 'Toggle Outline', category: 'view', defaults: ['Mod+Shift+O'] },
  { id: 'view.toggleInspector', label: 'Toggle Properties Inspector', category: 'view', defaults: ['Mod+Shift+I'] },
  { id: 'view.toggleToolbar', label: 'Show / Hide Toolbar Buttons', category: 'view', defaults: ['Mod+Alt+Shift+T'] },
  { id: 'git.toggleCommit', label: 'Git: Commit Panel', category: 'view', defaults: ['Mod+Alt+Shift+G'] },
  { id: 'git.toggleLog', label: 'Git: Log', category: 'view', defaults: ['Mod+9'] },
  { id: 'git.commit', label: 'Git: Commit', category: 'tools', scope: 'gitCommit', defaults: ['Mod+Enter'] },
  { id: 'git.push', label: 'Git: Push…', category: 'tools', defaults: ['Mod+Shift+U'] },
  { id: 'git.update', label: 'Git: Update Project', category: 'tools', defaults: ['Mod+Alt+U'] },
  { id: 'view.slideshow', label: 'Slideshow', category: 'view', defaults: ['Mod+Alt+P'] },
  // Folding. The chords mirror CodeMirror's own fold keymap so the muscle
  // memory carries over — but they are handled at app level, which is what
  // makes them work in the Windows plain-textarea editor too (it has no
  // CodeMirror keymap to reach).
  { id: 'fold.toggle', label: 'Fold / Unfold Section at Cursor', category: 'view', defaults: ['Mod+Shift+BracketLeft'] },
  { id: 'fold.all', label: 'Fold All Sections', category: 'view', defaults: ['Mod+Alt+BracketLeft'] },
  { id: 'fold.none', label: 'Unfold All', category: 'view', defaults: ['Mod+Alt+BracketRight'] },

  // ---- Navigate ----
  { id: 'palette.open', label: 'Command Palette', category: 'navigate', defaults: ['Mod+Shift+K'] },
  { id: 'quickSwitcher.open', label: 'Quick File Switcher', category: 'navigate', defaults: ['Mod+P'] },
  { id: 'search.global', label: 'Search in Folder', category: 'navigate', defaults: ['Mod+Shift+F'] },
  { id: 'editor.find', label: 'Find in Preview', category: 'navigate', defaults: ['Mod+F'] },
  { id: 'tab.prev', label: 'Previous Tab', category: 'navigate', defaults: ['Mod+BracketLeft'] },
  { id: 'tab.next', label: 'Next Tab', category: 'navigate', defaults: ['Mod+BracketRight'] },
  { id: 'tile.splitRight', label: 'Split Pane Right', category: 'navigate', defaults: ['Mod+Backslash'] },
  { id: 'tile.splitDown', label: 'Split Pane Down', category: 'navigate', defaults: ['Mod+Shift+Backslash'] },
  { id: 'tile.focusNext', label: 'Focus Next Pane', category: 'navigate', defaults: ['Mod+Alt+ArrowRight'] },
  { id: 'tile.focusPrev', label: 'Focus Previous Pane', category: 'navigate', defaults: ['Mod+Alt+ArrowLeft'] },

  // ---- Tools ----
  { id: 'mindmap.convertDocument', label: 'Mindmap: Convert Document to Map', category: 'tools', defaults: ['Mod+Alt+Shift+M'] },
  { id: 'mindmap.convertSection', label: 'Mindmap: Convert Section to Map', category: 'tools', defaults: [] },
  { id: 'mindmap.convertSelection', label: 'Mindmap: Convert Selection to Map', category: 'tools', defaults: [] },
  { id: 'mindmap.insertFenceFromSection', label: 'Mindmap: Insert Map Fence from Section', category: 'tools', defaults: [] },
  { id: 'mindmap.insertFenceFromSelection', label: 'Mindmap: Insert Map Fence from Selection', category: 'tools', defaults: [] },
  { id: 'mindmap.convertFolder', label: 'Mindmap: Convert Folder to Map', category: 'tools', defaults: [] },
  { id: 'mindmap.workbench', label: 'Mindmap: Open Workbench', category: 'tools', defaults: [] },
  { id: 'mindmap.folderTree', label: 'Mindmap: Folder Tree to Map', category: 'tools', defaults: [] },
  { id: 'settings.open', label: 'Settings', category: 'tools', defaults: ['Mod+Comma'] },
  { id: 'help.markdown', label: 'Markdown Help', category: 'tools', defaults: ['F1', 'Mod+Slash'] },
  { id: 'proofread.cjk', label: 'CJK Proofread', category: 'tools', defaults: ['Mod+Shift+J'] },
  { id: 'daily.openToday', label: "Open Today's Daily Note", category: 'tools', defaults: ['Mod+D'] },
  { id: 'inbox.toggle', label: 'Toggle Inbox Flag / Organize', category: 'tools', defaults: ['Mod+E'] },
  { id: 'pomodoro.startLast', label: 'Start Writing Session (Zen)', category: 'tools', defaults: ['Mod+Shift+Z'] },

  // ---- Mindmap (live only while a mindmap view has focus) ----
  { id: 'mindmap.toggleNode', label: 'Mindmap: Collapse / Expand Selection or Whole Map', category: 'mindmap', scope: 'mindmap', defaults: ['Space'] },
  { id: 'mindmap.fit', label: 'Mindmap: Fit to Window', category: 'mindmap', scope: 'mindmap', defaults: ['Mod+Alt+0'] },
  { id: 'mindmap.focusRoot', label: 'Mindmap: Select Root', category: 'mindmap', scope: 'mindmap', defaults: ['Home'] },
  { id: 'mindmap.shortcutHelp', label: 'Mindmap: Keyboard Shortcuts', category: 'mindmap', scope: 'mindmap', defaults: ['Shift+Slash'] },
  { id: 'mindmap.exportPng', label: 'Mindmap: Export as PNG', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.exportSvg', label: 'Mindmap: Export as SVG', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.exportHtml', label: 'Mindmap: Export as HTML', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.exportJson', label: 'Mindmap: Export as JSON', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.exportMarkdown', label: 'Mindmap: Export as Markdown List', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.copyPlaintext', label: 'Mindmap: Copy as Plaintext', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.toHeadingsDocument', label: 'Mindmap: Open as Markdown Headings', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.jumpToSource', label: 'Mindmap: Jump to Source', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.toggleReadOnly', label: 'Mindmap: Toggle Read-Only', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.togglePinStrip', label: 'Mindmap: Toggle Pin Strip', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.toggleSnippets', label: 'Mindmap: Toggle Snippets', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.exportMermaid', label: 'Mindmap: Export Graph as Mermaid', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.exportAdjacency', label: 'Mindmap: Export Graph as JSON Adjacency', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.markGateTarget', label: 'Mindmap: Mark Gate Target', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.insertGate', label: 'Mindmap: Insert Gate to Marked Node', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.followGate', label: 'Mindmap: Follow Gate', category: 'mindmap', scope: 'mindmap', defaults: ['Alt+Enter'] },
  { id: 'mindmap.gateBack', label: 'Mindmap: Back from Gate', category: 'mindmap', scope: 'mindmap', defaults: ['Alt+ArrowLeft'] },
  { id: 'mindmap.repairGate', label: 'Mindmap: Repair Gate to Marked Node', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.removeGate', label: 'Mindmap: Remove Gate', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.sortChildren', label: 'Mindmap: Sort Children by Name', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.numberChildren', label: 'Mindmap: Number Children', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.removeNumbers', label: 'Mindmap: Remove Numbering', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.layoutDown', label: 'Mindmap: Grow Down', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.findDuplicates', label: 'Mindmap: Find Duplicates', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.lensData', label: 'Mindmap: Data Lens', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.lensMap', label: 'Mindmap: Map Lens', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.lensDoc', label: 'Mindmap: Doc Lens', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.cycleLens', label: 'Mindmap: Cycle Lens', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.togglePanel', label: 'Mindmap: Toggle Side Panel', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.toggleDetails', label: 'Mindmap: Toggle Node Details Pane', category: 'mindmap', scope: 'mindmap', defaults: ['Mod+Alt+D'] },
  { id: 'mindmap.focusNode', label: 'Mindmap: Focus Node', category: 'mindmap', scope: 'mindmap', defaults: [] },
  { id: 'mindmap.cancelFocus', label: 'Mindmap: Cancel Focus', category: 'mindmap', scope: 'mindmap', defaults: [] },
];
