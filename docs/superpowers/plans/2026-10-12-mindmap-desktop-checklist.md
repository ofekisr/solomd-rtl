# Mindmap Desktop Checklist (4.16.0)

Run in the Tauri desktop app, not the web build. Tick each box; note failures inline.

Start: `pnpm --dir app tauri dev`

Prep: a workspace folder with `plan.xmind` (2+ sheets if you have one), a Markdown file with `#`/`##` headings and Hebrew text, and an empty folder for exports.

## 1. `.mmap` files (Phase 1)

- [ ] New `.mmap` file opens as a map with the file name as root
- [ ] Edit a topic, save, close, reopen: edit persists; tab dirty dot clears on save
- [ ] Hebrew topic aligns right on the map
- [ ] Collapse/expand (Space), fit (⌘⌥0), select root (Home) work
- [ ] `?` opens the shortcut help

## 2. XMind open (Phase 2 + Phase 7 fix)

- [ ] Open `plan.xmind`: import tab opens, toast "saving creates a .mmap"; multi-sheet warning if 2+ sheets
- [ ] Open `plan.xmind` again: same tab activates, no new tab
- [ ] Save it (creates `plan.mmap`), close the tab, open `plan.xmind`: `plan.mmap` opens, toast "Opened existing plan.mmap (imported earlier)"
- [ ] With `plan.mmap` open as a tab (opened directly), open `plan.xmind`: that tab activates
- [ ] Delete `plan.mmap`, open `plan.xmind`: fresh import tab again

## 3. Views: Map / Source / Outline (Phase 7)

- [ ] Toolbar switcher: Source shows highlighted JSON; Outline shows headings
- [ ] In Source, break the JSON and switch immediately to Map: stays in Source with the error
- [ ] Fix the JSON, switch to Map: map shows the edit
- [ ] Hebrew lines in Outline align right
- [ ] Quit and relaunch: each map tab reopens in its last view
- [ ] Corrupt `.mmap` → "Open as text" lands in Source (tab stays a mindmap)

## 4. Toolbar and `⋯` menu (Phase 4 + 7)

- [ ] Toolbar undo/redo work and save correctly
- [ ] Export PNG, SVG, HTML, JSON, Markdown, Mermaid, Adjacency JSON: each opens the native save dialog and writes a file that opens correctly
- [ ] Copy as plaintext → paste into a Markdown file renders as a mindmap fence
- [ ] Open as Markdown headings → new tab with headings
- [ ] Graph view and Read-only: checkmark shows, undo/redo and panel disable
- [ ] Find duplicates dialog opens; Keyboard shortcuts dialog opens
- [ ] Menu closes on outside click and when switching view

## 5. Right-click menu

- [ ] Focus Mode and Cancel Focus Mode appear once each and work
- [ ] Jump to source (on a map converted from Markdown) opens the source line
- [ ] Gate items: mark target, insert gate, follow (⌥↩), back (⌥←), repair, remove

## 6. Side panel: Node tab (Phase 7)

- [ ] Toolbar ▤ opens the panel; state survives relaunch
- [ ] Text color, background, font size, bold, branch color change the node live
- [ ] "Clear" removes each style; ⌘Z restores it
- [ ] Tags `a, b` render; icons toggle on/off; a non-grid icon on the node is kept
- [ ] URL `javascript:alert(1)` is rejected with a message; `https://…` shows a link icon and opens
- [ ] Hebrew note saves; Source view shows `"note"`
- [ ] Save, reopen: all node edits persist

## 7. Side panel: Map tab + Settings (Phase 7)

- [ ] Compact, Straight branches, Serif/Mono font apply live
- [ ] Text color: topics recolor, root stays readable; picker starts at the theme text color
- [ ] Save, reopen: map settings persist (Source shows a `display` block)
- [ ] "Use global default" removes each key; empty `display` disappears from the file
- [ ] Settings → Mindmap defaults: set Straight → maps without an override switch; a map with its own override keeps it
- [ ] Switch app theme light ↔ dark: map settings stay; panel and toolbar readable in both

## 8. Multi-select (Phase 7)

- [ ] Drag a box on empty canvas selects several nodes
- [ ] Delete removes all; ⌘Z restores all
- [ ] ⌘C / ⌘V copies the selection
- [ ] Panel Node tab shows "Select one node"

## 9. Markdown fences (Phase 3)

- [ ] A ```` ```mindmap ```` fence renders as a map in preview
- [ ] Fence opens in the fullscreen editor; edits write back to the fence
- [ ] Live-edit mode shows the fence widget

## 10. Convert Markdown → map (Phase 5)

- [ ] Convert Document (⌘⌥⇧M) → new `.mmap` tab with heading tree
- [ ] Convert Section / Selection; Insert Map Fence from Section / Selection
- [ ] Convert Folder dialog: readable, Escape closes, duplicates dialog works
- [ ] Jump to source from a converted node opens the right file and line

## 11. Lens, themes, settings (Phase 8)

- [ ] Lens x view cells (Data / Map / Doc against Edit, Split, Live edit, Preview, Reading) in the packaged app
- [ ] Reading on a wide map; Escape leaves it
- [ ] Themes in light and dark
- [ ] Settings → Mindmap
- [ ] Export split button through the native save dialogs
- [ ] Fit / Root controls and the duplicates chip
- [ ] Cmd+V on a read-only map adds nothing
- [ ] Cmd+X on a read-only map removes nothing
- [ ] Tab / Delete on focused Fit/Root controls do not change the map
- [ ] Data · Split with JSON invalid from the start

## 12. Snippets, freeze + focus, paste (Phase 9)

- [ ] Snippets: add, edit, reorder, delete each kind (md, Mermaid, map); Mermaid and Map render in the packaged app
- [ ] Markdown export through the native save dialog ends with `## Snippets`
- [ ] Frozen strip and focus, including RTL breadcrumb
- [ ] Undo after pasting a subtree with an internal gate keeps the gate resolved
- [ ] Cmd+V from the system clipboard: real XMind copy (record what XMind puts on the clipboard), a Markdown file, a `.mmap` file's text
- [ ] Cmd+V into a topic edit box pastes text only
