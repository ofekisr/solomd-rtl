import type { Extension } from '@codemirror/state';
import { extractImageRoot, liveBlocksExtension, liveBlocksTheme } from '../../../../lib/cm-live-blocks.ts';
import { livePreviewExtension, richHighlightOnly } from '../../../../lib/cm-live-preview.ts';
import { liveEditExtension, setLiveEditCopyLabel } from '../../../../lib/cm-live-render.ts';
import { graphvizThemeFor } from '../../../../lib/theme/mermaid.ts';
import { replaceBoardSnapshot } from '../../../../lib/tldraw-board.ts';
import type { EditorFeature, EditorFeatureContext } from '../../contracts/editor-feature.port.ts';
import { RELAYOUT_EVENT } from './appearance.feature.ts';

export type LiveBlocksOptions = NonNullable<Parameters<typeof liveBlocksExtension>[0]>;

// The tab object is captured at build time and closed over, as Editor.vue did,
// so a stale callback can never act on a different tab.
export function liveBlocksOptions(ctx: EditorFeatureContext): LiveBlocksOptions {
  const { settings } = ctx;
  const tab = ctx.tab();
  return {
    getImageRoot: () => extractImageRoot(tab.content || ''),
    getFilePath: () => tab.filePath,
    // F7 — live tldraw whiteboard theme + writeback.
    getBoardTheme: () => ({ colorScheme: ctx.themeMode(), locale: settings.language || 'en' }),
    getTabId: () => tab.id,
    // #354 — diagrams follow the app's light/dark family, like preview.
    getMermaidTheme: () => graphvizThemeFor(ctx.themeMode()),
    getPlantuml: () => ({ enabled: settings.plantumlEnabled, server: settings.plantumlServer }),
    // #353 — "Always show Markdown markers": keep every block's source.
    keepSource: () => settings.alwaysShowMarkers,
    getBoardStrings: () => ({
      loading: ctx.t('whiteboard.loading'),
      openFull: ctx.t('whiteboard.openFull'),
      loadFailed: ctx.t('whiteboard.loadFailed'),
    }),
    getMindmapStrings: () => ({
      openFull: ctx.t('mindmap.fenceOpenFull'),
      parseError: ctx.t('mindmap.fenceParseError'),
      gateBroken: ctx.t('mindmap.gateBroken'),
    }),
    onBoardEdit: (boardId, snapshotJson) => {
      const cur = ctx.findTab(tab.id);
      if (!cur) return;
      const next = replaceBoardSnapshot(cur.content || '', boardId, snapshotJson);
      if (next !== cur.content) ctx.setContent(tab.id, next);
    },
  };
}

export function richExtensionsFor(ctx: EditorFeatureContext): Extension {
  if (ctx.tab().language !== 'markdown') return [];
  const { settings } = ctx;
  // v2.3 live-edit takes precedence over livePreview — the WYSIWYG bundle already
  // includes rich highlighting + marker hiding; stacking would duplicate decorations.
  if (settings.viewMode === 'liveEdit') {
    // v3.6 issue #44: standalone image lines + GFM tables collapse into block widgets.
    return liveEditExtension([liveBlocksExtension(liveBlocksOptions(ctx)), liveBlocksTheme], { showMarkers: settings.alwaysShowMarkers });
  }
  return settings.livePreview
    ? livePreviewExtension({ showMarkers: settings.alwaysShowMarkers })
    : richHighlightOnly();
}

export function createLiveRenderFeature(): EditorFeature {
  return {
    id: 'live-render',
    settingsKeys: ['viewMode', 'livePreview', 'alwaysShowMarkers', 'plantumlEnabled', 'plantumlServer', 'language'],
    i18nKeys: ['toolbar.copy', 'whiteboard.loading', 'whiteboard.openFull', 'whiteboard.loadFailed', 'mindmap.fenceOpenFull', 'mindmap.fenceParseError', 'mindmap.gateBroken'],
    slots: [{
      slot: 'rich',
      deps: (ctx) => [ctx.tab().language, ctx.settings.alwaysShowMarkers, ctx.settings.livePreview, ctx.settings.viewMode],
      build: (ctx) => richExtensionsFor(ctx),
    }],
    // v4.10 #163 — the live-blocks field only rebuilds on doc/selection changes,
    // so nudge it when the PlantUML toggle/server flips.
    watches: [{
      deps: (ctx) => [ctx.settings.plantumlEnabled, ctx.settings.plantumlServer],
      run: () => { try { window.dispatchEvent(new CustomEvent(RELAYOUT_EVENT)); } catch {} },
    }],
    // The live-edit copy button lives in a CM widget with no i18n access.
    setup: (ctx) => { setLiveEditCopyLabel(() => ctx.t('toolbar.copy')); },
  };
}
