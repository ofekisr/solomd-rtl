import type { MapDisplay } from '../../../../lib/mindmap-display.ts';
import { parseMapDisplay } from '../../../../lib/mindmap-display.ts';
import type { TagRule } from '../../../../lib/mindmap-folder-tree.ts';
import { parseTagRules } from '../../../../lib/mindmap-folder-tree.ts';
import type { MindmapControlStyle } from '../../../../lib/mindmap-icon-names.ts';
import { normalizeControlStyle } from '../../../../lib/mindmap-icon-names.ts';
import type { PasteMapSetting } from '../../../../lib/mindmap-insert.ts';
import { normalizePasteMapSetting } from '../../../../lib/mindmap-insert.ts';
import type { StyleTemplate } from '../../../../lib/mindmap-style-templates.ts';
import { removeTemplate, upsertTemplate } from '../../../../lib/mindmap-style-templates.ts';
import type { SettingsThis } from './settings-this.ts';

export const mindmapActions = {
  setMindmapDefaults(this: SettingsThis, patch: MapDisplay) {
    this.mindmapDefaults = parseMapDisplay({ ...this.mindmapDefaults, ...patch });
    this.persist();
  },
  clearMindmapDefault(this: SettingsThis, key: keyof MapDisplay) {
    const next = { ...this.mindmapDefaults };
    delete next[key];
    this.mindmapDefaults = next;
    this.persist();
  },
  setMindmapFolderTagRules(this: SettingsThis, rules: TagRule[]) {
    this.mindmapFolderTagRules = parseTagRules(rules);
    this.persist();
  },
  toggleMindmapPanel(this: SettingsThis) {
    this.mindmapPanelOpen = !this.mindmapPanelOpen;
    this.persist();
  },
  toggleMindmapPinStrip(this: SettingsThis) {
    this.mindmapPinStripOpen = !this.mindmapPinStripOpen;
    this.persist();
  },
  toggleMindmapSnippets(this: SettingsThis) {
    this.mindmapSnippetsOpen = !this.mindmapSnippetsOpen;
    this.persist();
  },
  setMindmapSnippetsOpen(this: SettingsThis, isOpen: boolean) {
    if (this.mindmapSnippetsOpen === isOpen) return;
    this.mindmapSnippetsOpen = isOpen;
    this.persist();
  },
  setMindmapPanelOpen(this: SettingsThis, isOpen: boolean) {
    if (this.mindmapPanelOpen === isOpen) return;
    this.mindmapPanelOpen = isOpen;
    this.persist();
  },
  setMindmapDetailsOpen(this: SettingsThis, isOpen: boolean) {
    if (this.mindmapDetailsOpen === isOpen) return;
    this.mindmapDetailsOpen = isOpen;
    this.persist();
  },
  toggleMindmapDetails(this: SettingsThis) {
    this.mindmapDetailsOpen = !this.mindmapDetailsOpen;
    this.persist();
  },
  setMindmapDetailsHeight(this: SettingsThis, height: number) {
    this.mindmapDetailsHeight = height;
    this.persist();
  },
  setMindmapControlStyle(this: SettingsThis, style: MindmapControlStyle) {
    this.mindmapControlStyle = normalizeControlStyle(style);
    this.persist();
  },
  setMindmapPasteMapTarget(this: SettingsThis, value: PasteMapSetting) {
    this.mindmapPasteMapTarget = normalizePasteMapSetting(value);
    this.persist();
  },
  saveMindmapStyleTemplate(this: SettingsThis, template: StyleTemplate) {
    this.mindmapStyleTemplates = upsertTemplate(this.mindmapStyleTemplates, template);
    this.persist();
  },
  removeMindmapStyleTemplate(this: SettingsThis, name: string) {
    this.mindmapStyleTemplates = removeTemplate(this.mindmapStyleTemplates, name);
    this.persist();
  },
};
