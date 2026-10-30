export interface RightSidebarShell {
  /** Is the strip on screen right now? */
  visible: () => boolean;
  /** Switch something on that can actually draw; false if nothing can. */
  ensureRenderable: () => boolean;
}

/**
 * Make sure the right sidebar has something to draw, and report whether it
 * now does. Supplied by the shell (App.vue), which owns the per-pane rules —
 * asking it beats re-deriving them here, and it keeps this store from
 * importing the tabs store it already imports back.
 *
 * Why it exists: the strip only renders when at least one pane can draw, and
 * most panes need a workspace folder (Backlinks also needs a markdown tab).
 * On a fresh install with no folder open, Backlinks and Tags — the two panes
 * on by default — can draw nothing, so toggling the strip flipped a flag and
 * changed nothing on screen in either direction. The toolbar button, its
 * shortcut and the palette entry all read as dead until the user happened to
 * switch on the Outline, the one pane that needs only a markdown tab.
 */
let rightSidebarShell: RightSidebarShell | null = null;

export function setRightSidebarShell(shell: RightSidebarShell): void {
  rightSidebarShell = shell;
}

export function getRightSidebarShell(): RightSidebarShell | null {
  return rightSidebarShell;
}
