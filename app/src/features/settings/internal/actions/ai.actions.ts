import { clampAiDelay } from '../../../../lib/ai-activity.ts';
import type { SettingsThis } from './settings-this.ts';

export const aiActions = {
  setAiReleaseDelayMs(this: SettingsThis, ms: number) {
    this.aiReleaseDelayMs = clampAiDelay(ms, 'releaseDelayMs');
    this.persist();
  },
  setAiStaleTimeoutMs(this: SettingsThis, ms: number) {
    this.aiStaleTimeoutMs = clampAiDelay(ms, 'staleMs');
    this.persist();
  },
  setAiWarningAlwaysMinimized(this: SettingsThis, on: boolean) {
    this.aiWarningAlwaysMinimized = on;
    this.persist();
  },
  markAgentWizardSeen(this: SettingsThis) {
    this.agentWizardSeen = true;
    this.persist();
  },
  resetAgentWizard(this: SettingsThis) {
    this.agentWizardSeen = false;
    this.persist();
  },
  toggleAgentPanel(this: SettingsThis) {
    this.showAgentPanel = !this.showAgentPanel;
    if (this.showAgentPanel) this.ensureRightSidebarVisible();
    this.persist();
  },
  toggleAgentAllowWrite(this: SettingsThis) {
    this.agentAllowWrite = !this.agentAllowWrite;
    this.persist();
  },
  setAgentToolLoopCap(this: SettingsThis, n: number) {
    const clean = Math.max(1, Math.min(20, Math.round(n) || 8));
    this.agentToolLoopCap = clean;
    this.persist();
  },
  toggleAiEnabled(this: SettingsThis) {
    this.aiEnabled = !this.aiEnabled;
    this.persist();
  },
  setAiProvider(this: SettingsThis, p: string) {
    this.aiProvider = p;
    this.persist();
  },
  setAiModel(this: SettingsThis, m: string) {
    this.aiModel = m;
    this.persist();
  },
  setAiBaseUrl(this: SettingsThis, u: string) {
    this.aiBaseUrl = u;
    this.persist();
  },
};
