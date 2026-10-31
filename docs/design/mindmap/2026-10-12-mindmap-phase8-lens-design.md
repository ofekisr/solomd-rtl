# Mindmap Phase 8 — Lens (Data · Map · Doc), Themes, Toolbar Icons

## Status

Approved in conversation on 12-10-26. Branch: `feat/mindmap-phase8`. Base: `main` at `4.16.0`.
Done 12-10-26 (`4.16.1`) — plan `docs/plans/mindmap/2026-10-12-mindmap-phase8-lens.md`
Parent design: `docs/design/mindmap/2026-10-11-mindmap-design.md`. Previous: Phase 7 (`2026-10-12-mindmap-phase7-views-panel-design.md`). Unscheduled work: `2026-10-12-mindmap-follow-ups.md`.

## Purpose

Mindmap tabs use the same view buttons as Markdown tabs (Edit · Split · Live edit · Preview · Reading).
A per-tab **lens** decides what each button shows. This replaces Phase 7's Map / Source / Outline switcher.
The phase also moves map settings into their own Settings category, adds map themes, and promotes common actions out of the `⋯` menu.

## Scope

| § | Area | Outcome |
|---|---|---|
| 1 | Lens | Data · Map · Doc switch per map tab; global view buttons map through it |
| 2 | Settings category | Settings → 🧠 Mindmap holds all map defaults |
| 3 | Themes | 5 preset map themes, each with light and dark variants |
| 4 | Toolbar | ⬇ Export icon, Graph and Read-only toggle icons |
| 5 | Canvas controls | Fit and Root buttons; "N duplicates" chip |
| 6 | Read-only paste fix | Cmd+V cannot change a read-only or locked map |

Out of scope: editing the Markdown outline back into the map, and the cells that need it (follow-ups item 1). Those cells ship read-only here (🔒).

## 1. Lens

### Terms

| Term | Meaning |
|---|---|
| Lens | Which representation the tab works in: **Data** (JSON), **Map** (the map), **Doc** (the map as a Markdown document) |
| View | The global `settings.viewMode`: `edit`, `split`, `liveEdit`, `preview`, `reading` — the existing toolbar buttons |
| Cell | What a map tab renders for one lens × view pair |

### State

- `Tab.mindmapLens: 'data' | 'map' | 'doc'`, default `'map'`, persisted with the session. Unknown values fall back to `'map'`.
- Replaces `Tab.mindmapMode`. A stored `mindmapMode` migrates once: `source` → `data`, `outline` → `doc`, `map` → `map`.
- The view stays global and shared with Markdown tabs, exactly as today. Pressing a view button on a map tab changes `settings.viewMode` for all tabs.
- The `<>` live code preview button is inactive (disabled) while a map tab is active.

### Matrix

The full target (with editable Markdown cells) lives in the follow-ups doc. This phase ships:

| View | Data | Map | Doc |
|---|---|---|---|
| ✏️ Edit | JSON editor ✅ | Outline Markdown 🔒 | Outline Markdown 🔒 |
| ◫ Split | JSON editor ‖ Map 🆕 | Map ‖ Outline preview 🆕 | Outline Markdown 🔒 ‖ Outline preview |
| 📝 Live edit | Map ✅ | Map ✅ | Outline preview 🔒 |
| 👁 Preview | Outline preview ✅ | Outline preview ✅ | Outline preview ✅ |
| 📖 Reading | Wide map 🆕 | Wide map 🆕 | Outline reading 🆕 |

✅ exists (Phase 7) · 🆕 new, fully working · 🔒 read-only; becomes editable via follow-ups item 1

### Cell renderers

| Renderer | Built from | Editable |
|---|---|---|
| JSON editor | Phase 7 Source view (code editor, JSON highlighting, exit guard) | Yes |
| Map | `MindmapCanvas` | Yes (except read-only toggle) |
| Outline preview | Phase 7 Outline view (`Preview` over `mapToHeadingsMarkdown`, per-line direction) | No |
| Outline Markdown 🔒 | The same Markdown as text in a read-only `<pre>` (`dir="auto"` per line), with a one-line note "Editing Markdown → map is not available yet" | No |
| Wide map | `MindmapCanvas` read-only, no toolbar/panel, inside the app's reading layout | No |
| Outline reading | `ReadingView` rendering the outline Markdown | No |

### Split behaviour

- Data · Split: JSON editor on the inline-start side, map on the inline-end side. JSON edits redraw the map after they pass the existing parse + sanitize; while the JSON is invalid the map keeps its last valid state and the editor shows the error.
- Map edits in Data · Split update the JSON pane (existing debounced sync).
- Map · Split: map editable; outline preview re-renders live.
- Doc · Split: both sides read-only this phase.

### Transitions

- Leaving a cell that contains the JSON editor (lens change or view change) runs the Phase 7 exit guard: flush, parse; on failure stay and show the error. For a view change the guard blocks the global change only while a map tab is active.
- Leaving a cell that contains an editable map flushes the canvas first.
- Reading on a map tab: `ReadingView` renders the active map tab's reading cell instead of Markdown.

### Toolbar switch

The map toolbar's Map / Source / Outline control becomes **Data · Map · Doc** (segmented, `role="tablist"`), labels `mindmap.lensData`, `mindmap.lensMap`, `mindmap.lensDoc`.
Commands: `mindmap.lensData`, `mindmap.lensMap`, `mindmap.lensDoc`, `mindmap.cycleLens` (no default keys). They replace `mindmap.viewMap`, `mindmap.viewSource`, `mindmap.viewOutline`, `mindmap.cycleView`; old ids are removed from the registry, and a user binding stored under an old id migrates to its new id.

## 2. Settings → 🧠 Mindmap

- New category `mindmap` in the Settings sidebar (icon 🧠, label `settings.catMindmap`).
- Moves the "Mindmap defaults" section there from Writing.
- Adds the default theme (§3).
- Section titles carry search keywords so settings search finds "mindmap", "map", "theme", "branch", "compact".

## 3. Map themes

- Presets: **Default**, **Ocean**, **Forest**, **Mono**, **High contrast**.
- Each preset has a light and a dark variant: a branch `palette` (8 colors) and `cssVar` overrides (`--bgcolor`, `--root-bgcolor`, `--root-color`, `--main-bgcolor`, `--main-color`, `--color`, `--selected`).
- The variant follows the app theme family (light/dark), as today.
- `MapDisplay` gains `theme?: MapThemeId`; per-file override and global default resolve like the other display keys.
- Applied through `changeTheme({ ...variant, type })` before compact, branch style, text color and font (Phase 7 apply order stays valid after it).
- Map text color (Phase 7) still overrides `--color` and `--main-color` on top of the preset.
- High contrast meets WCAG AA (≥ 4.5:1) for topic text against its background in both variants.
- Map tab and Settings get a theme picker (select with a color swatch strip per option).

## 4. Toolbar icons

| Control | Behaviour |
|---|---|
| ⬇ Export | Split button: main part exports PNG; the caret opens all 7 formats. Removed from `⋯`. |
| Graph view | Toggle icon (`aria-pressed`). Removed from `⋯`. |
| Read-only | Toggle icon (`aria-pressed`). Removed from `⋯`. |
| `⋯` | Keeps Copy as plaintext, Open as Markdown headings, Keyboard shortcuts. |

- Icon buttons have `aria-label` and `title`.
- Disabled where the cell has no editable map (same rule as Phase 7).

## 5. Canvas controls

- **Fit** and **Root** buttons sit beside the package's zoom controls (bottom inline-end corner), styled like them. They run `mindmap.fit` and `mindmap.focusRoot`.
- **Duplicates chip**: a small floating chip "N duplicates" at the top inline-end of the canvas, shown only when duplicate groups exist; clicking opens the existing duplicates dialog. Recomputed after map operations, debounced.
- "Find duplicates" leaves the `⋯` menu (the command stays in the palette).

## 6. Read-only paste fix

Bug on `main`: Mind Elixir's paste listener (`MindElixir.js` container `paste` handler) never checks `editable`, so with a node selected, pasting copied nodes into a read-only map inserts them. `scheduleSync` checks `props.locked` only, so the change can reach the file.

- `sanitizeCopiedNodes` wrapper in `MindmapCanvas.vue`: no-op while `isEditBlocked()` or graph view.
- `scheduleSync`: also skip while the read-only toggle is on.
- Test: browser — read-only on, copy a node, select another, Cmd+V → no new node, file not dirty; same with `locked`. Read-only off → paste still works.

## Decisions during planning

| Spec says | Plan does | Why |
|---|---|---|
| Data · Split: invalid JSON keeps the last valid map | It also locks the map (read-only, no sync) while the JSON is invalid | A map edit would otherwise serialize over the user's unfinished JSON |
| Theme picker: select with a swatch strip per option | Radio group of buttons, each with a label and an 8-swatch strip | Native `<option>` cannot render swatches |
| Fit and Root sit beside the zoom controls | Appended into the package's `.mind-elixir-toolbar.rb` element | Gets the same position and styling with no duplicate positioning code |
| "N duplicates" | N = number of duplicate groups | Matches what the dialog lists |
| (silent) | The fit-width toolbar button stays Markdown-only | It only affects Markdown preview width |
| (silent) | Phase 7's `applyText` removed `--color`/`--main-color` when no text color was set. It now leaves them alone. | `changeTheme` already resets both to the preset. Removing them would erase the preset's text colors. |

### Execution decisions

| Topic | Decision | Why |
|---|---|---|
| `Object.hasOwn` | Replaced by a `hasOwnProperty` helper | tsconfig `lib` is ES2020 |
| Locked canvas | Blocks every mutation path (merge, gates, undo/redo, paste, cut) and drops pending syncs when it engages | A locked map must not change or overwrite the JSON |
| Settings → Mindmap | Section has a hint line | Settings search finds "map" / "theme" |
| Canvas controls | Stop key propagation for every key | Tab / Delete on focused Fit/Root must not reach the map |
| Toolbar states | Read-only toggle and JSON lock are separate states | Different causes, different recovery |

## Testing

| Area | Tests |
|---|---|
| Lens model | Unit: normalize, migrate `mindmapMode`, cell lookup for all 15 lens × view pairs, keybinding id migration |
| Split | Browser: Data · Split edits both ways; invalid JSON keeps last map; Map · Split live outline |
| Reading | Browser: wide map and outline reading from a map tab; Escape returns |
| Themes | Unit: preset shape, resolution, AA contrast check for High contrast. Browser: each preset in light and dark |
| Settings | Browser: 🧠 Mindmap category, search finds it |
| Toolbar / canvas | Browser: export split button, toggles, Fit/Root, duplicates chip appears and opens dialog |

Desktop (Tauri) check before merge.
