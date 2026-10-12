# Mindmap Phase 10 — Framing, Reading Width, Corner Docks, Mouse Pan

## Status

Approved in conversation on 13-10-26. Branch: `feat/mindmap-corner-docks`. Base: Phase 9 (`2026-10-12-mindmap-phase9-snippets-focus-design.md`, 4.16.2).

## Purpose

- A map opens with its whole tree in view, not with the root centred and half the branches off-screen.
- Reading mode shows the map at full width.
- The toolbar row above the map goes away. Its controls move into floating corner docks, and multi-choice controls collapse into one button that opens a flyout.
- A mouse can pan the canvas the way two-finger trackpad swipes do.

## Scope

| § | Area | Outcome | Est. |
|---|---|---|---|
| 1 | Framing | Layout-aware initial and recentre position | ~1 h |
| 2 | Reading width | Map fills the reading pane | ~15 min |
| 3 | Corner docks | Toolbar row removed; top-start rail + bottom-end nav dock with flyouts | ~4 h |
| 4 | Mouse pan | ⌥ + mouse move pans; ✋ toggle inverts | ~2 h |

Out of scope: new toolbar actions, keyboard-shortcut changes, wheel-to-zoom, touch gestures, dock drag/reposition, the `Down` layout in the direction flyout (Mind Elixir's own toolbar never offered it).

## 1. Framing

### Problem

`centerOnceLaidOut()` calls `mind.toCenter()`, which centres the **root**. In a right-direction map every branch sits right of the root, so half the tree is off-screen (screenshot 1). Mind Elixir also calls `toCenter()` after direction changes, focus enter/exit and on F1.

### Design

- New pure module `lib/mindmap-frame.ts`: `frameOffset(input): { x: number; y: number }`.
  - Input: container rect, content (`mind.nodes`) rect, root rect, layout, padding.
  - Content fits the container → centre the content bounding box.
  - Content too wide/tall → anchor the root side:

| Layout | Too wide | Too tall |
|---|---|---|
| RIGHT | content start edge at inline padding | centre root vertically |
| LEFT | content end edge at inline padding | centre root vertically |
| SIDE | centre root | centre root vertically |
| DOWN | centre root horizontally | content top at padding |

- `MindmapCanvas.vue` wraps `instance.toCenter` (same pattern as `wrapFocus`): reset scroll, compute the offset, write the transform with the current `scaleVal`.
- In focus mode Mind Elixir forces RIGHT; framing reads `mind.direction` live, so it follows.
- The ⌖ centre button and ⌂ root button both reach the wrapper.

### Tests

- `mindmap-frame.test.ts`: fits → bbox centred; each layout × overflow axis from the table; padding constant applied.

## 2. Reading width

- Cause: `ReadingView.vue` stretches `> .mindmap-view`, but Phase 9 wrapped the reading map in `.mindmap-reading__wide`. The flex row shrinks the wrapper to its intrinsic width (screenshot 2).
- Fix: `.mindmap-reading__wide { flex: 1; min-width: 0; }` in `MindmapReading.vue`; drop the stale `.reading-view__doc--map > .mindmap-view` rule.

## 3. Corner docks

### Removed

- `MindmapToolbar.vue` row in `MindmapView.vue`.
- Mind Elixir's built-in toolbars: `toolBar: false`. `appendCanvasControls` and its package-DOM coupling go too.

### Components

| Unit | Purpose |
|---|---|
| `MindmapDock.vue` | Positioned container (`corner: 'top-start' \| 'bottom-end'`, `orientation`) with logical insets, so RTL mirrors automatically |
| `MindmapDockButton.vue` | Icon button: label/title, `pressed`, `disabled` |
| `MindmapDockFlyout.vue` | Button showing the current choice's icon; click opens a flyout of options. Esc, outside pointer, or picking closes it. `role="menu"`, arrow-key navigation |
| `lib/mindmap-flyout.ts` | Pure open/close/active-index state, unit tested |

### Placement

**Top-start rail** — rendered by `MindmapView.vue` over the shell body, so it stays visible when the lens has no canvas (Data and Doc in Edit view):

| Control | Kind | Options / action |
|---|---|---|
| Lens | flyout | Data · Map · Doc |
| Direction | flyout | left · right · side (`initLeft/Right/Side`) — only with a canvas |
| Graph view | toggle | `mindmap.toggleGraphView` |
| Read-only | toggle | `mindmap.toggleReadOnly` |
| Panel | toggle | `settings.toggleMindmapPanel()` |
| Undo / Redo | buttons | `mindmap.undo` / `mindmap.redo` |
| Export | flyout | the 7 formats from today's export menu |
| More | flyout | copy plaintext · headings document · shortcuts |

Disabled rules carry over unchanged from `MindmapToolbar.vue`. Controls that need a canvas are hidden, not disabled, when the lens has no map.

**Bottom-end nav dock** — rendered by `MindmapCanvas.vue`, so edit, reading and fence maps all get it:

fullscreen · centre (framing) · zoom − · zoom + · fit · root · ✋ pan toggle.

- Zoom uses `mind.scale(scaleVal ± scaleSensitivity)`; fullscreen uses `container.requestFullscreen()`, the same as the package toolbar did.
- In Data lens the rail floats over the JSON editor's top-start corner (accepted trade-off). The editor gets top padding equal to the rail button size so line 1 stays readable.

### Icons and i18n

- Reuse `Icon.vue` where an icon exists; add the missing ones (direction ×3, lens ×3, fullscreen, pan).
- Labels reuse the existing `mindmap.toolbar*` keys; new keys for the dock and flyout names in every locale file.

### Tests

- `mindmap-flyout.test.ts`: open/close, Esc, outside pointer, arrow wrap, pick closes.
- Component smoke: rail renders the lens flyout with no canvas; nav dock is absent when the parse fails.

## 4. Mouse pan

### Behaviour

| ✋ toggle | Plain mouse move | ⌥ + mouse move |
|---|---|---|
| off (default) | normal pointer | canvas pans with the pointer |
| on | canvas pans with the pointer | normal pointer |

- Mouse only (`pointerType === 'mouse'`), no button pressed. Trackpad swipes, pinch, wheel, Space-drag and right-drag keep Mind Elixir's behaviour.
- Panning pauses while a topic is being edited, while a menu/flyout is open, and while the pointer is over a dock.
- Cursor shows `grab` while pan is active.

### Design

- `composables/useMindmapHoverPan.ts`: listens to `pointermove` on the canvas host, plus `keydown`/`keyup`/`blur` for ⌥. Pan is active when `toggle XOR altKey` and not paused. It applies `mind.move(e.movementX, e.movementY)`.
- Pure decision `isPanActive({ toggle, altKey, pointerType, buttons, paused })` in `lib/mindmap-hover-pan.ts`, unit tested.
- Setting `mindmapHoverPan: boolean` (default `false`) in the settings store, persisted. The ✋ nav button toggles it.

## Verification

- `pnpm test` green; `vue-tsc` clean.
- Manual, in the app: right/left/side map opens fully framed; reading mode full width; every rail and nav control works in LTR and RTL; ⌥-hover pans; ✋ inverts it.
