import { z } from 'zod';
import type { MapDisplay } from '../../../../lib/mindmap/display.ts';
import { parseMapDisplay } from '../../../../lib/mindmap/display.ts';
import type { TagRule } from '../../../../lib/mindmap/folder-tree.ts';
import { parseTagRules } from '../../../../lib/mindmap/folder-tree.ts';
import type { MindmapControlStyle } from '../../../../lib/mindmap/icon-names.ts';
import { DEFAULT_MINDMAP_CONTROL_STYLE, normalizeControlStyle } from '../../../../lib/mindmap/icon-names.ts';
import type { PasteMapSetting } from '../../../../lib/mindmap/insert.ts';
import { normalizePasteMapSetting } from '../../../../lib/mindmap/insert.ts';
import type { StyleTemplate } from '../../../../lib/mindmap/style-templates.ts';
import { normalizeStyleTemplates } from '../../../../lib/mindmap/style-templates.ts';
import type { SettingsSlice } from '../../contracts/index.ts';

export type MindmapSettings = {
  /** Phase 7 — global map display defaults; a `.mmap` `display` block overrides per key. */
  mindmapDefaults: MapDisplay;
  mindmapPanelOpen: boolean;
  mindmapDetailsOpen: boolean;
  mindmapPinStripOpen: boolean;
  mindmapSnippetsOpen: boolean;
  mindmapDetailsHeight: number;
  mindmapControlStyle: MindmapControlStyle;
  mindmapPasteMapTarget: PasteMapSetting;
  mindmapStyleTemplates: StyleTemplate[];
  mindmapFolderTagRules: TagRule[];
};

const schema = z.object({
  mindmapDefaults: z.custom<MapDisplay>(),
  mindmapPanelOpen: z.boolean(),
  mindmapDetailsOpen: z.boolean(),
  mindmapPinStripOpen: z.boolean(),
  mindmapSnippetsOpen: z.boolean(),
  mindmapDetailsHeight: z.number(),
  mindmapControlStyle: z.custom<MindmapControlStyle>(),
  mindmapPasteMapTarget: z.custom<PasteMapSetting>(),
  mindmapStyleTemplates: z.array(z.custom<StyleTemplate>()),
  mindmapFolderTagRules: z.array(z.custom<TagRule>()),
});

function defaults(): MindmapSettings {
  return {
    mindmapDefaults: {},
    mindmapPanelOpen: false,
    mindmapDetailsOpen: false,
    mindmapPinStripOpen: true,
    mindmapSnippetsOpen: false,
    mindmapDetailsHeight: 220,
    mindmapControlStyle: DEFAULT_MINDMAP_CONTROL_STYLE,
    mindmapPasteMapTarget: 'ask',
    mindmapStyleTemplates: [],
    mindmapFolderTagRules: [
      { suffix: '.spec.ts', tag: 'tests' },
      { suffix: '.test.ts', tag: 'tests' },
      { suffix: 'CLAUDE.md', tag: 'claude' },
    ],
  };
}

export const mindmapSlice: SettingsSlice<MindmapSettings> = {
  id: 'mindmap',
  schema,
  defaults,
  normalize(parsed, merged) {
    merged.mindmapDefaults = parseMapDisplay(parsed.mindmapDefaults);
    merged.mindmapControlStyle = normalizeControlStyle(parsed.mindmapControlStyle);
    merged.mindmapPasteMapTarget = normalizePasteMapSetting(parsed.mindmapPasteMapTarget);
    merged.mindmapStyleTemplates = normalizeStyleTemplates(parsed.mindmapStyleTemplates);
    if (parsed.mindmapFolderTagRules !== undefined) merged.mindmapFolderTagRules = parseTagRules(parsed.mindmapFolderTagRules);
  },
};
