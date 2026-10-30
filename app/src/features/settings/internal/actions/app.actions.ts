import { clampAutoSaveDelay } from '../../../../lib/auto-save.ts';
import type { ConvertConflictSetting } from '../../../../lib/convert-conflict.ts';
import { normalizeConvertConflictSetting } from '../../../../lib/convert-conflict.ts';
import { isViewModeChangeAllowed } from '../../../../lib/view-mode-guard.ts';
import type { ViewMode } from '../../../../types.ts';
import type { SettingsThis } from './settings-this.ts';

export const appActions = {
  setStartupViewMode(this: SettingsThis, mode: ViewMode | null) {
    this.startupViewMode = mode;
    this.persist();
  },
  setViewMode(this: SettingsThis, mode: ViewMode) {
    if (mode !== this.viewMode && !isViewModeChangeAllowed(mode)) return;
    // Remember whatever non-reading mode we were in before — the
    // reading-mode close button / Esc handler restores it.
    if (mode !== 'reading' && this.viewMode !== 'reading') {
      this.lastNonReadingViewMode = mode;
    } else if (mode !== 'reading') {
      this.lastNonReadingViewMode = mode;
    }
    this.viewMode = mode;
    this.persist();
  },
  cycleViewMode(this: SettingsThis) {
    // `liveEdit` (v2.3) joins the cycle — order chosen so the WYSIWYG
    // mode lives between split (markup-visible) and preview (rendered).
    // `reading` (v2.4) joins as the 5th cycle target — full-bleed serif
    // preview, last in the cycle so the common edit/split toggle keeps
    // its muscle memory at the top of the rotation.
    const order: ViewMode[] = ['edit', 'split', 'liveEdit', 'preview', 'reading'];
    const i = order.indexOf(this.viewMode);
    this.setViewMode(order[(i + 1) % order.length]);
  },
  /** #180 - flip between live edit (WYSIWYG) and edit only (source).
   *  From any other view (split, preview, reading) it lands in live edit. */
  toggleLiveEditSource(this: SettingsThis) {
    this.setViewMode(this.viewMode === 'liveEdit' ? 'edit' : 'liveEdit');
  },
  /**
   * Toggle reading mode on/off. If the user is currently in reading mode
   * we restore whatever they were in before; otherwise we save the
   * current mode and snap to reading.
   */
  toggleReadingMode(this: SettingsThis) {
    if (this.viewMode === 'reading') {
      this.exitReadingMode();
    } else {
      if (!isViewModeChangeAllowed('reading')) return;
      this.lastNonReadingViewMode = this.viewMode;
      this.viewMode = 'reading';
      this.persist();
    }
  },
  /** Restore the last non-reading view mode (used by Esc / close button). */
  exitReadingMode(this: SettingsThis) {
    // Defensive: never exit *into* reading mode (would loop). Default
    // back to 'edit' if the saved sentinel is somehow 'reading'.
    const next = this.lastNonReadingViewMode === 'reading' ? 'edit' : this.lastNonReadingViewMode;
    this.viewMode = next;
    this.persist();
  },
  /** #180 — `combo` sets an override, `null` unbinds, `undefined` restores
   *  the default (we delete the key so future default changes reach the
   *  user instead of being pinned to whatever shipped today). */
  setKeybinding(this: SettingsThis, actionId: string, combo: string | null | undefined) {
    if (combo === undefined) delete this.keybindings[actionId];
    else this.keybindings[actionId] = combo;
    this.persist();
  },
  resetKeybindings(this: SettingsThis) {
    this.keybindings = {};
    this.persist();
  },
  toggleAutoCheckUpdate(this: SettingsThis) {
    this.autoCheckUpdate = !this.autoCheckUpdate;
    this.persist();
  },
  toggleTelemetry(this: SettingsThis) {
    this.telemetryEnabled = !this.telemetryEnabled;
    this.persist();
  },
  ackTelemetryNotice(this: SettingsThis) {
    this.telemetryNoticeAck = true;
    this.persist();
  },
  toggleRestoreSession(this: SettingsThis) {
    this.restoreSession = !this.restoreSession;
    this.persist();
  },
  togglePerWorkspaceTabs(this: SettingsThis) {
    this.perWorkspaceTabs = !this.perWorkspaceTabs;
    this.persist();
  },
  toggleAutoReloadExternalChanges(this: SettingsThis) {
    this.autoReloadExternalChanges = !this.autoReloadExternalChanges;
    this.persist();
  },
  setConvertConflictChoice(this: SettingsThis, choice: ConvertConflictSetting) {
    if (this.convertConflictChoice === choice) return;
    this.convertConflictChoice = normalizeConvertConflictSetting(choice);
    this.persist();
  },
  toggleAutoSaveAfterDelay(this: SettingsThis) {
    this.autoSaveAfterDelay = !this.autoSaveAfterDelay;
    this.persist();
  },
  setAutoSaveDelayMs(this: SettingsThis, ms: number) {
    this.autoSaveDelayMs = clampAutoSaveDelay(ms);
    this.persist();
  },
  toggleAutoSaveOnBlur(this: SettingsThis) {
    this.autoSaveOnBlur = !this.autoSaveOnBlur;
    this.persist();
  },
  toggleOpenFileInNewWindow(this: SettingsThis) {
    this.openFileInNewWindow = !this.openFileInNewWindow;
    this.persist();
  },
  toggleRevealInFileTreeOnOpen(this: SettingsThis) {
    this.revealInFileTreeOnOpen = !this.revealInFileTreeOnOpen;
    this.persist();
  },
  toggleOpenLinkedFilesExternally(this: SettingsThis) {
    this.openLinkedFilesExternally = !this.openLinkedFilesExternally;
    this.persist();
  },
  markWelcomeShown(this: SettingsThis) {
    this.welcomeShown = true;
    this.persist();
  },
};
