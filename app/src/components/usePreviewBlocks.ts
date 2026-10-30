import { watch, type Ref } from 'vue';
import { initMermaid } from '../lib/mermaid-lazy';
import { renderGraphvizBlocks } from '../lib/graphviz';
import { mermaidConfigFor, graphvizThemeFor, cssColorToHex } from '../lib/theme/mermaid';
import { useThemeStore } from '../stores/theme';
import { findMindmapFences, MINDMAP_OPEN_EVENT, type MindmapOpenDetail } from '../lib/mindmap/fence';
import type { ReadOnlyMindmap } from '../lib/mindmap/readonly';
import { plantumlSvgUrl } from '../lib/plantuml';
import { useSettingsStore } from '../stores/settings';
import { useI18n } from '../i18n';

export interface PreviewBlocksProps { source: string; tabId?: string }

export function usePreviewBlocks(host: Ref<HTMLDivElement | null>, props: PreviewBlocksProps) {
  const settings = useSettingsStore();
  const themeStore = useThemeStore();
  const { t } = useI18n();
  let mermaidIdSeq = 0;

  // v4.10 issue #163 — render ```plantuml fences through the configured
  // PlantUML server. Opt-in (`plantumlEnabled`); when off the fence stays a
  // plain code block. Display is an <img> (no fetch → no CORS); onerror keeps
  // the source visible with a hint instead of a broken image.
  function processPlantuml() {
    if (!host.value) return;
    if (!settings.plantumlEnabled || !settings.plantumlServer) return;
    const blocks = host.value.querySelectorAll(
      'pre > code.language-plantuml, pre > code.language-puml',
    );
    for (const block of Array.from(blocks)) {
      const pre = block.parentElement as HTMLElement | null;
      if (!pre || pre.dataset.rendered === '1') continue;
      const code = (block.textContent || '').trim();
      const wrap = document.createElement('div');
      wrap.className = 'plantuml-block';
      const img = document.createElement('img');
      img.alt = 'PlantUML diagram';
      img.loading = 'lazy';
      img.src = plantumlSvgUrl(settings.plantumlServer, code);
      img.addEventListener('error', () => {
        const err = document.createElement('pre');
        err.className = 'plantuml-error';
        err.textContent = `PlantUML render failed (${settings.plantumlServer})\n\n${code}`;
        wrap.replaceWith(err);
      });
      wrap.appendChild(img);
      pre.replaceWith(wrap);
    }
  }

  async function processMermaid() {
    if (!host.value) return;
    const blocks = host.value.querySelectorAll('pre > code.language-mermaid');
    if (!blocks.length) return;   // a note without diagrams never loads mermaid
    const mermaid = await initMermaid({
      startOnLoad: false,
      securityLevel: 'strict',
      ...mermaidConfigFor(themeStore.resolved, cssColorToHex),
    });
    for (const block of Array.from(blocks)) {
      const pre = block.parentElement as HTMLElement | null;
      if (!pre || pre.dataset.rendered === '1') continue;
      const code = (block.textContent || '').trim();
      const id = `mmd-${++mermaidIdSeq}`;
      try {
        const { svg } = await mermaid.render(id, code);
        const wrap = document.createElement('div');
        wrap.className = 'mermaid-block';
        // Keep the source so a theme switch can re-render this diagram.
        wrap.dataset.mermaidSource = code;
        wrap.innerHTML = svg;
        pre.replaceWith(wrap);
      } catch (e) {
        const err = document.createElement('pre');
        err.className = 'mermaid-error';
        err.textContent = `Mermaid error: ${(e as Error).message}`;
        pre.replaceWith(err);
      }
    }
  }

  function processGraphviz(): Promise<void> {
    if (!host.value) return Promise.resolve();
    return renderGraphvizBlocks(host.value, { theme: graphvizThemeFor(themeStore.mode) });
  }

  // v4.6 F7 — render ```tldraw fences as static board thumbnails in the preview.
  // The fence body is a TLStoreSnapshot; we ask the runtime adapter (dynamic
  // import) to export it to a printable SVG so non-editing surfaces stay light.
  // The board class survives markdown-it as `code.language-tldraw`.
  async function processWhiteboards() {
    if (!host.value) return;
    const blocks = host.value.querySelectorAll('pre > code.language-tldraw');
    if (blocks.length === 0) return;
    const { boardToSvg } = await import('../lib/tldraw-runtime');
    // Parse the source fences once so each preview block can recover its stable
    // boardId/snapshot for the click-to-fullscreen affordance. markdown-it drops
    // the fence attributes (id/height), so we match preview blocks to source
    // fences positionally (same document order).
    const { findTldrawFences } = await import('../lib/tldraw-board');
    const fences = findTldrawFences(props.source || '');
    const theme = {
      colorScheme: themeStore.mode,
      locale: settings.language || 'en',
    };
    const list = Array.from(blocks);
    for (let idx = 0; idx < list.length; idx++) {
      const block = list[idx];
      const pre = block.parentElement as HTMLElement | null;
      if (!pre || pre.dataset.rendered === '1') continue;
      pre.dataset.rendered = '1';
      const snapshot = (block.textContent || '').trim();
      const fence = fences[idx];
      const wrap = document.createElement('div');
      wrap.className = 'whiteboard-block';
      const makeEditable = (svg: string) => {
        wrap.innerHTML = svg;
        // Only the editor preview can write back — read-only skins (slideshow,
        // export) omit tabId, so the thumbnail stays a static image there.
        if (fence && props.tabId) {
          wrap.classList.add('whiteboard-block--clickable');
          wrap.setAttribute('role', 'button');
          wrap.setAttribute('tabindex', '0');
          wrap.title = t('whiteboard.openFull');
          const openFull = () => {
            window.dispatchEvent(
              new CustomEvent('solomd:whiteboard-open', {
                detail: { boardId: fence.boardId, tabId: props.tabId, snapshot: fence.snapshot },
              }),
            );
          };
          wrap.addEventListener('click', openFull);
          wrap.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault();
              openFull();
            }
          });
        }
      };
      try {
        const svg = await boardToSvg(snapshot, theme);
        if (svg) {
          makeEditable(svg);
        } else {
          wrap.classList.add('whiteboard-block--empty');
          wrap.textContent = t('whiteboard.empty');
        }
        pre.replaceWith(wrap);
      } catch {
        wrap.classList.add('whiteboard-block--empty');
        wrap.textContent = t('whiteboard.loadFailed');
        pre.replaceWith(wrap);
      }
    }
  }

  const mindmapMounts: ReadOnlyMindmap[] = [];

  function destroyMindmaps(): void {
    for (const map of mindmapMounts.splice(0)) map.destroy();
  }

  function isDarkTheme(): boolean {
    return themeStore.mode === 'dark';
  }

  function openMindmapButton(detail: MindmapOpenDetail): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mindmap-block__open';
    button.textContent = t('mindmap.fenceOpenFull');
    button.addEventListener('click', () => window.dispatchEvent(new CustomEvent(MINDMAP_OPEN_EVENT, { detail })));
    return button;
  }

  let mindmapPass = 0;

  function showMindmapError(wrap: HTMLElement, message: string): void {
    wrap.classList.add('mindmap-block--broken');
    wrap.textContent = `${t('mindmap.fenceParseError')}: ${message}`;
  }

  async function mountMindmapInto(wrap: HTMLElement, canvas: HTMLElement, body: string): Promise<ReadOnlyMindmap | null> {
    try {
      const { mountReadOnlyMindmap } = await import('../lib/mindmap/readonly');
      const result = await mountReadOnlyMindmap(canvas, body, isDarkTheme(), t('mindmap.gateBroken'));
      if (result.ok) return result.map;
      showMindmapError(wrap, result.error);
    } catch (error) {
      showMindmapError(wrap, error instanceof Error ? error.message : String(error));
    }
    return null;
  }

  async function renderMindmapBlock(pre: HTMLElement, body: string, line: number | null, pass: number): Promise<void> {
    const wrap = document.createElement('div');
    wrap.className = 'mindmap-block';
    const canvas = document.createElement('div');
    canvas.className = 'mindmap-block__canvas';
    wrap.append(canvas);
    pre.replaceWith(wrap);
    const map = await mountMindmapInto(wrap, canvas, body);
    if (!map) return;
    if (pass !== mindmapPass || !canvas.isConnected) return map.destroy();
    mindmapMounts.push(map);
    if (props.tabId && line !== null) wrap.append(openMindmapButton({ tabId: props.tabId, line, body }));
  }

  const SOURCE_LINE_ATTR = 'data-source-line';

  function editableFenceLine(code: Element, editableLines: Set<number>): number | null {
    const oneBased = Number(code.getAttribute(SOURCE_LINE_ATTR));
    if (!Number.isInteger(oneBased) || oneBased < 1) return null;
    return editableLines.has(oneBased - 1) ? oneBased - 1 : null;
  }

  async function processMindmaps(): Promise<void> {
    if (!host.value) return;
    const pass = ++mindmapPass;
    destroyMindmaps();
    const blocks = Array.from(host.value.querySelectorAll('pre > code.language-mindmap'));
    const editableLines = new Set(findMindmapFences(props.source).map((fence) => fence.line));
    for (const block of blocks) {
      if (pass !== mindmapPass) return;
      const pre = block.parentElement;
      if (!pre || pre.dataset.rendered === '1') continue;
      pre.dataset.rendered = '1';
      await renderMindmapBlock(pre, block.textContent ?? '', editableFenceLine(block, editableLines), pass);
    }
  }

  watch(() => themeStore.revision, () => {
    for (const map of mindmapMounts) map.setDark(isDarkTheme());
  });

  // The theme is applied by processMermaid on each render pass. Diagrams already
  // on screen were drawn for the old theme and processMermaid skips them, so put
  // their source back as a fence first and let it render them again (#354).
  // A note with no diagrams still never loads the renderer.
  watch(() => themeStore.revision, () => {
    if (host.value) {
      for (const wrap of Array.from(host.value.querySelectorAll<HTMLElement>('.mermaid-block[data-mermaid-source]'))) {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.className = 'language-mermaid';
        code.textContent = wrap.dataset.mermaidSource ?? '';
        pre.appendChild(code);
        wrap.replaceWith(pre);
      }
      for (const wrap of Array.from(host.value.querySelectorAll<HTMLElement>('.graphviz-block[data-graphviz-source]'))) {
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.className = 'language-dot';
        code.textContent = wrap.dataset.graphvizSource ?? '';
        pre.appendChild(code);
        wrap.replaceWith(pre);
      }
    }
    void processMermaid();
    void processGraphviz();
  });

  async function processAllBlocks(): Promise<void> {
    processPlantuml();
    await processMermaid();
    await processGraphviz();
    await processWhiteboards();
    await processMindmaps();
  }

  function disposeBlocks(): void {
    mindmapPass++;
    destroyMindmaps();
  }

  return { processAllBlocks, disposeBlocks };
}
