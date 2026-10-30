import { getRightSidebarShell } from './right-sidebar-shell.ts';
import type { SettingsThis } from './settings-this.ts';

export const layoutActions = {
  toggleOutline(this: SettingsThis) {
    this.showOutline = !this.showOutline;
    this.persist();
  },
  setOutlineSide(this: SettingsThis, side: 'left' | 'right') {
    this.outlineSide = side;
    this.persist();
  },
  setOutlineMarker(this: SettingsThis, marker: 'jump' | 'number' | 'none') {
    this.outlineMarker = marker;
    this.persist();
  },
  toggleViewsPanel(this: SettingsThis) {
    this.showViewsPanel = !this.showViewsPanel;
    this.persist();
  },
  toggleRightSidebar(this: SettingsThis) {
    const rightSidebarShell = getRightSidebarShell();
    // v4.3.0 PR #75 — when hiding, snapshot the current pane visibility so
    // toggling back on can restore the exact layout instead of a blank
    // sidebar; when restoring, ensure at least one pane is on so the
    // sidebar isn't empty.
    //
    // Which way to go is decided by what is on screen, not by this flag.
    // The two differ whenever the flag says "shown" but every pane in the
    // strip is gated off (no workspace folder), and then a press took the
    // hide branch and changed nothing visible — the reported dead button,
    // which needed a second press to do anything at all.
    const onScreen = rightSidebarShell
      ? rightSidebarShell.visible()
      : !this.rightSidebarHidden;
    if (onScreen) {
      this._rsPanesBeforeHide = {
        showBacklinks: this.showBacklinks,
        showRelationships: this.showRelationships,
        showTagsPanel: this.showTagsPanel,
        showNeighborhood: this.showNeighborhood,
        showTypesPanel: this.showTypesPanel,
        showHistoryPanel: this.showHistoryPanel,
        showAgentPanel: this.showAgentPanel,
      };
      this.rightSidebarHidden = true;
    } else {
      this.rightSidebarHidden = false;
      const saved = this._rsPanesBeforeHide;
      if (saved) {
        this.showBacklinks = saved.showBacklinks;
        this.showRelationships = saved.showRelationships;
        this.showTagsPanel = saved.showTagsPanel;
        this.showNeighborhood = saved.showNeighborhood;
        this.showTypesPanel = saved.showTypesPanel;
        this.showHistoryPanel = saved.showHistoryPanel;
        this.showAgentPanel = saved.showAgentPanel;
        this._rsPanesBeforeHide = null;
      }
      if (!this.showBacklinks && !this.showRelationships && !this.showTagsPanel && !this.showTypesPanel && !this.showNeighborhood && !this.showHistoryPanel && !this.showAgentPanel) {
        this.showBacklinks = true;
        this.showTagsPanel = true;
      }
      // Switching those flags on is not enough to make the strip appear:
      // they are gated on a workspace folder. Ask the shell to find
      // something that can actually draw (it falls back to the Outline,
      // which needs only a markdown tab).
      if (rightSidebarShell && !rightSidebarShell.ensureRenderable()) {
        // Nothing in the strip can draw anything: no folder, no markdown
        // document. Stay hidden rather than leave a button that looks
        // broken, and let the caller say why out loud.
        this.rightSidebarHidden = true;
        this.persist();
        return false;
      }
    }
    this.persist();
    return !this.rightSidebarHidden;
  },
  /** v4.3.0 PR #75 — called when the user toggles off the last visible
   *  pane via the right-click context menu; auto-hides the sidebar and
   *  remembers the pre-toggle layout for later restore. */
  hideRightSidebarFromPane(this: SettingsThis, paneBeforeToggle: {
    showBacklinks: boolean;
    showRelationships: boolean;
    showTagsPanel: boolean;
    showNeighborhood: boolean;
    showTypesPanel: boolean;
    showHistoryPanel: boolean;
    showAgentPanel: boolean;
  }) {
    this._rsPanesBeforeHide = paneBeforeToggle;
    this.rightSidebarHidden = true;
    this.persist();
  },
  /** v4.3.0 PR #75 — ensure the sidebar is visible (used when toggling a
   *  pane ON from the context menu while the sidebar was auto-hidden). */
  ensureRightSidebarVisible(this: SettingsThis) {
    if (this.rightSidebarHidden) {
      this.rightSidebarHidden = false;
      this.persist();
    }
  },
  toggleToolbarHidden(this: SettingsThis) {
    this.toolbarHidden = !this.toolbarHidden;
    this.persist();
  },
  toggleFormatHints(this: SettingsThis) {
    this.formatHints = !this.formatHints;
    this.persist();
  },
  markFormatHintSeen(this: SettingsThis, key: string) {
    if (!this.formatHintsSeen.includes(key)) this.formatHintsSeen.push(key);
    this.persist();
  },
  toggleBacklinks(this: SettingsThis) {
    this.showBacklinks = !this.showBacklinks;
    if (this.showBacklinks) this.ensureRightSidebarVisible();
    this.persist();
  },
  toggleRelationships(this: SettingsThis) {
    this.showRelationships = !this.showRelationships;
    if (this.showRelationships) this.ensureRightSidebarVisible();
    this.persist();
  },
  toggleTagsPanel(this: SettingsThis) {
    this.showTagsPanel = !this.showTagsPanel;
    if (this.showTagsPanel) this.ensureRightSidebarVisible();
    this.persist();
  },
  toggleTasksPanel(this: SettingsThis) {
    this.showTasksPanel = !this.showTasksPanel;
    this.persist();
  },
  toggleNeighborhood(this: SettingsThis) {
    this.showNeighborhood = !this.showNeighborhood;
    if (this.showNeighborhood) this.ensureRightSidebarVisible();
    this.persist();
  },
  // v4.6 F2 — toggle the Types (types-as-lenses) sidebar pane.
  toggleTypesPanel(this: SettingsThis) {
    this.showTypesPanel = !this.showTypesPanel;
    if (this.showTypesPanel) this.ensureRightSidebarVisible();
    this.persist();
  },
  setSideSidebarWidth(this: SettingsThis, w: number) {
    // Reasonable bounds — narrower than 220 hides text, wider than 800
    // eats too much editor space.
    const clean = Math.max(220, Math.min(800, Math.round(w) || 260));
    this.sideSidebarWidth = clean;
    this.persist();
  },
  /** v4.6 F1 — toggle the Properties inspector pane (⌘⇧I). */
  toggleInspector(this: SettingsThis) {
    this.showInspector = !this.showInspector;
    if (this.showInspector) this.ensureRightSidebarVisible();
    this.persist();
  },
  setRightSidebarPaneHeight(this: SettingsThis, paneId: string, px: number) {
    const clean = Math.max(80, Math.min(2000, Math.round(px) || 0));
    // Allocate a fresh object so Vue reactivity picks up the mutation
    // (the persist() write would catch it, but watchers keyed on the
    // map need the identity change to fire).
    this.rightSidebarPaneHeights = { ...this.rightSidebarPaneHeights, [paneId]: clean };
    this.persist();
  },
  clearRightSidebarPaneHeights(this: SettingsThis) {
    this.rightSidebarPaneHeights = {};
    this.persist();
  },
  /** v4.3.0 issue #57b — reorder the right sidebar by moving a pane id to
   *  a new index. Tolerates out-of-range targets (clamps), no-ops for
   *  unknown ids. */
  moveRsPane(this: SettingsThis, paneId: string, targetIdx: number) {
    const order = [...(this.rsPaneOrder || [])];
    const from = order.indexOf(paneId);
    if (from < 0) return;
    const [item] = order.splice(from, 1);
    const clamped = Math.max(0, Math.min(order.length, targetIdx));
    order.splice(clamped, 0, item);
    this.rsPaneOrder = order;
    this.persist();
  },
  resetRsPaneOrder(this: SettingsThis) {
    this.rsPaneOrder = ['search', 'outline', 'backlinks', 'relationships', 'tags', 'tasks', 'neighborhood', 'types', 'history', 'inspector', 'agent'];
    this.persist();
  },
};
