import { z } from 'zod';
import { isMobile } from '../../../../lib/platform.ts';
import type { SettingsSlice } from '../../contracts/index.ts';

export type LayoutSettings = {
  showOutline: boolean;
  outlineSide: 'left' | 'right';
  // v4.6.2 — outline heading marker style. 'jump' = a/b/c… keyboard-jump labels
  // (default; mixes letters + digits past 25 headings); 'number' = clean
  // sequential 1/2/3…; 'none' = hidden.
  outlineMarker: 'jump' | 'number' | 'none';
  /** v4.6 F5 — show the Saved Views panel (left sidebar, below the file tree).
   *  Lists persistent filtered note lists from `.solomd/views/*.yml`. Default
   *  off so the panel only appears once the user opts in / creates a view. */
  showViewsPanel: boolean;
  /** Master toggle that hides the right side sidebar (Outline / Backlinks /
   *  Tags / History / Agent Panel) without forgetting which individual panes
   *  the user had on. Default false (= sidebar visible whenever any pane is
   *  enabled, i.e. legacy behavior). Set true via the toolbar close button,
   *  the ⌥⌘B shortcut, or the command palette to hide it; toggling again
   *  restores all previously-enabled panes in their previous state. */
  rightSidebarHidden: boolean;
  /** #346: hide the toolbar's buttons for a distraction-free, keyboard-only
   *  setup. The window strip (drag area, file name, window controls and the
   *  Windows menubar) stays. Where the OS draws the title bar, the whole
   *  toolbar goes. */
  toolbarHidden: boolean;
  /** One-time tips when Markdown formatting is typed by hand (useFormatHints). */
  formatHints: boolean;
  /** Hint keys already shown — `bold`, `heading`, … Never shown twice. */
  formatHintsSeen: string[];
  // v2.0 F1: show the Backlinks panel (right of editor) for markdown docs.
  showBacklinks: boolean;
  // v4.6 F3: show the Relationships panel (typed forward + inverse edges).
  showRelationships: boolean;
  showTagsPanel: boolean;
  // Workspace-wide task panel: every `- [ ]` in the vault, grouped by file.
  showTasksPanel: boolean;
  // v4.6 F4: Neighborhood — per-note relationship explorer pane (frontmatter
  // wikilink groups + inverse scan + body backlinks).
  showNeighborhood: boolean;
  // v4.6 F2: Types sidebar pane (types-as-lenses). Notes with `type:<Name>`
  // grouped into collapsible first-class sidebar sections.
  showTypesPanel: boolean;
  // Width (in px) of the right/left side sidebar that hosts Outline /
  // Backlinks / Tags / History / Agent Panel. The agent panel needs more
  // room than read-only browsing; user-resizable via the drag handle.
  sideSidebarWidth: number;
  /** v4.6 F1 — show the Properties inspector pane (frontmatter editor) in the
   *  right sidebar. Toggled via ⌘⇧I / command palette. */
  showInspector: boolean;
  /** v4.0.2 — per-pane heights in the right sidebar (issue #6 / #52 / #55).
   *  Map of pane id → flex-basis pixels. Panes without an entry use
   *  proportional flex grow (legacy behavior). Once the user drags a
   *  splitter the touched panes get explicit pixel heights. */
  rightSidebarPaneHeights: Record<string, number>;
  // v4.3.0: user-customisable order of the right-sidebar panes. Each entry
  // is a pane id (search / outline / backlinks / tags / history / agent).
  // Default matches the pre-v4.3.0 hardcoded order. Panes not in the list
  // (newly added in a future release) get appended to the end so the user's
  // saved layout isn't blown away by a SoloMD update. Issue #57b.
  rsPaneOrder: string[];
  // v4.3.0 PR #75 (beihai23) — transient (not persisted) snapshot of the
  // right-sidebar pane visibility taken when the sidebar is hidden, so
  // toggling it back on can restore the exact previous layout instead of
  // leaving the user with a blank sidebar.
  _rsPanesBeforeHide: {
    showBacklinks: boolean;
    showRelationships: boolean;
    showTagsPanel: boolean;
    showNeighborhood: boolean;
    showTypesPanel: boolean;
    showHistoryPanel: boolean;
    showAgentPanel: boolean;
  } | null;
};

const RS_PANES_SNAPSHOT_SCHEMA = z.object({
  showBacklinks: z.boolean(),
  showRelationships: z.boolean(),
  showTagsPanel: z.boolean(),
  showNeighborhood: z.boolean(),
  showTypesPanel: z.boolean(),
  showHistoryPanel: z.boolean(),
  showAgentPanel: z.boolean(),
});

const schema = z.object({
  showOutline: z.boolean(),
  outlineSide: z.enum(['left', 'right']),
  outlineMarker: z.enum(['jump', 'number', 'none']),
  showViewsPanel: z.boolean(),
  rightSidebarHidden: z.boolean(),
  toolbarHidden: z.boolean(),
  formatHints: z.boolean(),
  formatHintsSeen: z.array(z.string()),
  showBacklinks: z.boolean(),
  showRelationships: z.boolean(),
  showTagsPanel: z.boolean(),
  showTasksPanel: z.boolean(),
  showNeighborhood: z.boolean(),
  showTypesPanel: z.boolean(),
  sideSidebarWidth: z.number(),
  showInspector: z.boolean(),
  rightSidebarPaneHeights: z.record(z.string(), z.number()),
  rsPaneOrder: z.array(z.string()),
  _rsPanesBeforeHide: RS_PANES_SNAPSHOT_SCHEMA.nullable(),
});

function defaults(): LayoutSettings {
  return {
    showOutline: false,
    outlineSide: 'right',
    outlineMarker: 'jump',
    showViewsPanel: false,
    // #148 (mobile) — on a phone the left tree + editor + right panels can't
    // share the narrow width (the doc becomes an unreadable sliver), so the
    // right sidebar starts hidden. The editor + file tree behave as mutually
    // exclusive full-width views (opening a file collapses the tree).
    rightSidebarHidden: isMobile(),
    toolbarHidden: false,
    formatHints: true,
    formatHintsSeen: [],
    showBacklinks: true,
    showRelationships: false,
    showTagsPanel: true,
    showTasksPanel: false,
    showNeighborhood: false,
    showTypesPanel: false,
    sideSidebarWidth: 260,
    showInspector: false,
    rightSidebarPaneHeights: {},
    rsPaneOrder: ['search', 'outline', 'backlinks', 'relationships', 'tags', 'tasks', 'neighborhood', 'types', 'history', 'inspector', 'agent'],
    _rsPanesBeforeHide: null,
  };
}

export const layoutSlice: SettingsSlice<LayoutSettings> = {
  id: 'layout',
  schema,
  defaults,
};
