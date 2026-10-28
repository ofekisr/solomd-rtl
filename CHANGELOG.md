# Changelog

Changes added in **solomd-rtl** on top of upstream SoloMD. Newest first.

## 4.38.9 — 2026-10-28
- **Fixed:** Editor and preview syntax highlighting now use the same colours. Unified HighlightStyle in themes.ts references `--syn-*` CSS variables instead of hardcoded theme palettes, so both rendering paths pick up colours from main.css.

## 4.38.8 — 2026-10-28
- **Added:** Syntax highlighting for whole `.vue`, `.svelte`, `.scss`, `.less`, `.sass`, `.mts`, `.cts` and `.jsonc` files (previously only inside Markdown code fences).

## 4.37.0 — 2026-10-27
- **Added:** Any open file locks while an AI agent edits it: the editor goes read-only, Markdown and mind map tabs switch to preview, and an "AI working" warning shows.
- **Added:** The warning's "−" minimizes it to a strip below the editor; "Keep minimized for this tab" and "Always minimize" make that stick. The strip disappears when the AI stops.
- **Added:** Claude Code plugin hooks mark files busy with a per-session `.<name>.ai-lock-<session>` file on Edit / Write / MultiEdit / NotebookEdit and clear them on Stop / SessionEnd; abandoned sessions are swept at session start.
- **Added:** Settings → Advanced: AI-working release delay (default 2 s), timeout (default 60 s), and Always minimize.
- **Changed:** Several AI sessions on one file count as a semaphore — the file unlocks only when all of them finish. The mindmap MCP server writes a per-server marker and removes it on SIGTERM / SIGINT.
- **Fixed:** A file opened while an AI is already editing it locks at once; old leftover markers are ignored.

## 4.35.1 — 2026-10-25
- **Changed:** The AI-working warning is a large card over a dimmed tab instead of a thin strip.

## 4.35.0 — 2026-10-25
- **Added:** A mind map tab locks while an AI edits it through the mindmap MCP: it switches to preview, shows a closable "AI working" warning, and returns to your view mode when the AI stops.
- **Added:** Mindmap MCP server marks a map busy with a hidden `.<name>.mmap.ai-lock` file next to it (removed after 4s idle; read-only servers and session scans write none).

## 4.34.0 — 2026-10-25
- **Added:** Style panel: Corner radius (with a Custom shape state) and Padding fields.
- **Added:** Style panel: apply a style template, or save the node's look as one.
- **Added:** File explorer right-click: Open on left / right / below / above (splits or reuses the outermost pane).
- **Changed:** Copied styles save hex colors and whole-pixel sizes, so the style panel can show and edit them.

## 4.33.0 — 2026-10-25
- **Added:** Style templates: save a node's look under a name and apply it from the node context menu (global, up to 30).
- **Added:** View-mode toggle beside the sidebar toggles, synced with the view buttons.
- **Changed:** `padding` is an allowed node style key.

## 4.32.2 — 2026-10-25
- **Fixed:** Copy style copies what the node looks like, including theme styling of main-branch nodes.

## 4.32.1 — 2026-10-25
- **Fixed:** Copy / Paste style acts on the live node and always reports the result.

## 4.32.0 — 2026-10-25
- **Added:** "Copy & paste" submenu is the first item in the node context menu.
- **Changed:** Copy style also copies the branch color.

## 4.31.1 — 2026-10-25
- **Fixed:** Right-click selects the node under the pointer (reverted in 4.32.0; it wasn't needed).

## 4.31.0 — 2026-10-25
- **Added:** Node context menu: Copy path, Copy style, Paste style.

## 4.30.0 — 2026-10-25
- **Added:** Code blocks render as one unit; diagram blocks get per-block Edit / Split / Preview.
- **Added:** `{ }` data-lens toggle on `.mmap` tabs, synced with the map lens.
- **Added:** Pinned tabs — stay at the front of every pane's tab bar.
- **Fixed:** Single working block-mode toggle; Split goes side by side when wide.

## 4.29.0 — 2026-10-25
- **Added:** Graphviz diagrams for ` ```dot `, ` ```graphviz `, ` ```gv ` fences (preview, editor, exports).
- **Changed:** Mindmap skill splits multi-item notes into child nodes.

## 4.28.3 — 2026-10-24
- **Fixed:** Mind map pans past the centre until only a strip stays in view.

## 4.28.2 — 2026-10-24
- **Fixed:** Editor freeze when selecting wrapped lines with inline code (WebKit).

## 4.28.1 — 2026-10-22
- **Fixed:** Marquee select on empty canvas.
- **Fixed:** Side panel shows the node's effective style.

## 4.28.0 — 2026-10-22
- **Changed:** Graph view is an overlay, not a lock.
- **Added:** Pin strip and Snippets toolbar toggles.

## 4.27.0 — 2026-10-22
- **Added:** Auto-save after typing.
- **Added:** Explorer "New File" submenu with file types.
- **Added:** One tab per file; confirm before a conversion overwrites a file.
- **Changed:** Toolbar — Split after Preview, code glyph for Edit; new map defaults (layout grows right).

## 4.26.0 — 2026-10-21
- **Added:** Mind map grow-down layout and arrow branch style.
- **Added:** Sort children by name; auto-number children.
- **Added:** Child-count badge on folded nodes.
- **Added:** Sort, numbering and grow-down are keybindable.

## 4.25.0 — 2026-10-21
- **Added:** Mind map Workbench — collect maps and merge into a saved file.
- **Added:** Copy map / Paste map, with a remembered paste-location choice.
- **Added:** MCP tools `mmap_merge` and `mmap_graft`.

## 4.24.0 — 2026-10-21
- **Added:** Git pane (JetBrains-style): Commit panel, side-by-side diff tab with hunk staging, Git Log dock with branch graph, status-bar branch widget, push / checkout dialogs, conflict banner.
- **Added:** Trust prompt for repos whose config can run programs.
- **Fixed:** Windows git detection; hardened git calls (config, submodules, hooks).

## 4.23.1 — 2026-10-20
- **Added:** WebStorm-style scope picker for "Folder tree to map".

## 4.23.0 — 2026-10-20
- **Added:** Folder tree → mind map command.

## 4.22.0 — 2026-10-20
- **Added:** Full node style panel with multi-node batch edit.
- **Added:** Shortcut help as a floating, draggable cheatsheet.
- **Fixed:** Tabs silently failing to save when localStorage is full.
- **Fixed:** Explorer header buttons overflowing the sidebar.

## 4.21.0 — 2026-10-20
- **Added:** Show / hide hidden files toggle in the Explorer.

## 4.20.0 — 2026-10-20
- **Added:** 58 more fence languages highlighted; terminal fences in the editor.
- **Added:** Gate shortcuts in the context menu; "Back from gate".
- **Changed:** Mindmap MCP defaults its workspace to the current folder.
- **Fixed:** Stale gate labels no longer mark a map modified on open.
- **Fixed:** Inline-code spans in the desktop build.

## 4.19.0 — 2026-10-17
- **Added:** Preview folding, single-line fences, translate menu.
- **Added:** Terminal-session code blocks in preview.
- **Added:** Find wrap presets that skip Markdown code.
- **Changed:** Tighter spaces in inline code.
- **Removed:** Simplified Chinese UI.

## 4.18.0 — 2026-10-16
- **Added:** Mindmap MCP server (read, edit, gate, legend, mark, create, export, reveal) + Claude Code plugin with skill and session-binding hook.
- **Added:** IDE-style ⌘F find bar with File / Folder / All scope.
- **Added:** Folder-wide find & replace with regex groups.
- **Added:** Find & replace over mind map node text.

## 4.17.0 — 2026-10-13
- **Added:** Bottom node-details pane with live Markdown note and fields.
- **Added:** Playwright demo videos (8 stories + highlights reel).
- **Fixed:** Context menu closes after SoloMD menu items.

## 4.16.6 — 2026-10-13
- **Added:** Pin any node as the freeze-strip root.

## 4.16.5 — 2026-10-13
- **Added:** Chord pan — press right while marquee-selecting.
- **Added:** Space / dock button collapse or expand selection or whole map.
- **Changed:** Hover-pan removed; framed strip gets a lighter surface.
- **Changed:** Telemetry off by default, no upstream endpoint.

## 4.16.4 — 2026-10-13
- **Added:** Classic / Compact map control style; Classic frames the freeze strip.

## 4.16.3 — 2026-10-13
- **Added:** Corner docks replace the toolbar row; layout-aware framing.
- **Fixed:** Reading-mode map fills the pane width.

## 4.16.0 – 4.16.2 — 2026-10-12
- **Added:** Data · Map · Doc lens driving the global view buttons.
- **Added:** Five map theme presets (light / dark) with picker.
- **Added:** Fit / Root canvas controls, duplicates chip, export split button.
- **Added:** Snippets stored in `.mmap`, panel under the map.
- **Added:** Freeze strip (root / level 2) and per-tab focus.
- **Added:** ⌘V imports JSON, plain text, Markdown and outlines as a subtree.
- **Added:** Settings → Mindmap category.
- **Fixed:** Paste cannot change a read-only or locked map.

## 4.15.0 – 4.15.1 — 2026-10-12
- **Added:** Map / Source / Outline view modes per tab.
- **Added:** Map toolbar, overflow menu, focus commands.
- **Added:** Side panel for node and map display settings (per-file override + global defaults).
- **Fixed:** Opening an `.xmind` reuses an existing tab or `.mmap` file.

## 4.14.13 — 2026-10-12
- **Added:** Convert Markdown (document, section, selection, folder) into a mind map or fence.

## 4.14.12 — 2026-10-12
- **Added:** Mind map export — text, PNG, SVG, Markdown headings.
- **Added:** Gates (same-map links) with follow / back and `- => ref` fence syntax.
- **Added:** Duplicate finder with merge into gate.
- **Added:** Graph view; Mermaid / JSON adjacency export.
- **Added:** Jump from node to source line; read-only toggle; palette commands.

## 4.14.11 — 2026-10-12
- **Added:** ` ```mindmap ` fences rendered in preview and live editor; fullscreen fence editor.

## 4.14.10 — 2026-10-11
- **Added:** Open `.xmind` files as sanitized maps that save as `.mmap`.

## 4.14.9 — 2026-10-11
- **Added:** `.mmap` mind map files edited in a Mind Elixir view.
- **Added:** Scoped, rebindable mind map shortcuts.
- **Fixed:** Sanitized loaded / pasted maps (HTML, unsafe links).

## 4.14.8 — 2026-10-08
- **Added:** Directive completions from manifest files (editor + text areas); folder setting.
- **Added:** `.pyj` files highlighted as Python.

## 4.14.7 — 2026-10-02
- **Added:** Shell file and Markdown fence highlighting.
- **Added:** CLI opens folders by absolute or relative path.

## 4.14.6 — 2026-10-02
- **Added:** Numbered content blocks in preview.
- **Added:** Language highlighting for standalone code files.
- **Fixed:** RTL caret and gutter placement.

## 4.14.5 — 2026-10-01
- **Added:** Whole-file Hebrew / Arabic right-to-left support.
- **Fixed:** Indented blocks align with RTL documents.
