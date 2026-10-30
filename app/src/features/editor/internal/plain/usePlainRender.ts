import { type PlainBlock, plainTocFingerprint, splitPlainMarkdownBlocks } from './plain-blocks.ts';
import { attachCodeCopyButtons } from '../../../../lib/code-copy';
import { computed, nextTick } from 'vue';
import { cssColorToHex, graphvizThemeFor, mermaidConfigFor } from '../../../../lib/theme/mermaid';
import { extractImageRoot as extractMarkdownImageRoot, renderMarkdown } from '../../../../lib/markdown/markdown';
import { findTldrawFences } from '../../../../lib/tldraw-board';
import { initMermaid } from '../../../../lib/mermaid-lazy';
import { installSvgImageFallbacks, rewriteImageUrls } from '../../../../lib/image/resolve';
import { plantumlSvgUrl } from '../../../../lib/plantuml';
import { renderGraphvizBlocks } from '../../../../lib/graphviz';
import { useSettingsStore } from '../../../../stores/settings';
import { useThemeStore } from '../../../../stores/theme';
import { useToastsStore } from '../../../../stores/toasts';
import { useI18n } from '../../../../i18n';
import type { PlainApiStage3 } from './plain-api.ts';
import type { PlainDeps } from './plain-deps.ts';

export function usePlainRender(deps: PlainDeps, api: PlainApiStage3) {
  const { props } = deps;
  const settings = useSettingsStore();
  const themeStore = useThemeStore();
  const toasts = useToastsStore();
  const { t } = useI18n();
  const { plainActiveBlock, plainLiveEnabled, plainLiveHost, plainSelectAll, plainText } = api;

  let plainMermaidIdSeq = 0;
  const plainRenderCache = new Map<string, string>();

  const plainBlocks = computed<PlainBlock[]>(() => {
    if (!plainLiveEnabled.value) return [];
    // Select-all mode (user feedback, 4.8.10): the whole document is presented
    // as ONE active block so the <textarea>'s native selection can span it.
    // Every selection consumer then works untouched — Ctrl+C/X, Delete,
    // type-over, IME composition-over-selection (a WebView2 minefield we must
    // not reimplement), and the toolbar/⌘J AI-rewrite absolute offsets.
    if (plainSelectAll.value) {
      const src = plainText.value || '';
      return [{ id: 'select-all', start: 0, end: src.length, text: src, hasTrailingNewline: false, html: '' }];
    }
    return splitPlainMarkdownBlocks(plainText.value || '').map((block, index) => ({
      ...block,
      id: `${block.start}:${index}`,
      html: index === plainActiveBlock.value ? '' : renderPlainBlock(block.text),
    }));
  });

  function renderPlainBlock(src: string): string {
    // A standalone thematic-break block ("---" / "***" / "___") would be misread
    // as a YAML front-matter fence when rendered in isolation (each block renders
    // on its own), producing an empty md-frontmatter element instead of a rule.
    // Emit the <hr> directly.
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(src)) return '<hr>';
    const root = extractMarkdownImageRoot(plainText.value || '');
    // #141 — the hard-breaks flag is part of the cache key so toggling the
    // setting invalidates previously rendered blocks. The per-call `breaks`
    // override is gone: the shared md singleton now follows the setting, so
    // the live editor, preview pane and exports all agree.
    const isTocBlock = /^[ \t]*\[toc\][ \t]*$/i.test(src);
    // A rendered live-edit block normally only sees its own source. TOC is the
    // exception: it needs the whole document's headings, and the cache key must
    // change when any of those headings changes.
    const tocSource = isTocBlock ? plainText.value || '' : undefined;
    const tocKey = tocSource === undefined ? '' : `\u0000toc:${plainTocFingerprint(tocSource)}`;
    const key = `${settings.markdownHardBreaks ? 'hb' : 'sb'}${settings.markdownAutoNumberHeadings ? 'nh' : ''}\u0000${props.tab.filePath || ''}\u0000${root}\u0000${src}${tocKey}`;
    const cached = plainRenderCache.get(key);
    if (cached != null) return cached;
    const html = rewriteImageUrls(
      // Drop `disabled` on task checkboxes so they can be clicked to toggle in the
      // preview (handled by activatePlainBlockFromClick → togglePlainTask).
      renderMarkdown(src || '\n', { tocSource }).replace(
        /(<input class="task-list-item-checkbox" type="checkbox"[^>]*?)\s+disabled=""/g,
        '$1',
      ),
      root,
      props.tab.filePath,
    );
    plainRenderCache.set(key, html);
    if (plainRenderCache.size > 300) plainRenderCache.clear();
    return html;
  }


  async function processPlainLiveRenderedBlocks() {
    if (!plainLiveEnabled.value || !plainLiveHost.value) return;
    await nextTick();
    const hostEl = plainLiveHost.value;
    installSvgImageFallbacks(hostEl);

    // v4.10 #163 — PlantUML fences (opt-in), same <img> swap as the preview pane.
    if (settings.plantumlEnabled && settings.plantumlServer) {
      const pumlBlocks = hostEl.querySelectorAll(
        '.plain-block__render pre > code.language-plantuml, .plain-block__render pre > code.language-puml',
      );
      for (const block of Array.from(pumlBlocks)) {
        const pre = block.parentElement as HTMLElement | null;
        if (!pre || pre.dataset.rendered === '1') continue;
        pre.dataset.rendered = '1';
        const code = (block.textContent || '').trim();
        const wrap = document.createElement('div');
        wrap.className = 'plain-plantuml-block';
        const img = document.createElement('img');
        img.alt = 'PlantUML diagram';
        img.src = plantumlSvgUrl(settings.plantumlServer, code);
        img.addEventListener('error', () => {
          wrap.classList.add('plain-block__broken');
          wrap.textContent = `PlantUML render failed (${settings.plantumlServer})`;
        });
        wrap.appendChild(img);
        pre.replaceWith(wrap);
      }
    }

    const mermaidBlocks = hostEl.querySelectorAll('.plain-block__render pre > code.language-mermaid');
    // Configure on demand rather than at setup: the theme is read here, so a
    // theme switch between renders is picked up, and a vault with no diagrams
    // never loads the renderer at all.
    const mermaid = mermaidBlocks.length
      ? await initMermaid({
          startOnLoad: false,
          securityLevel: 'strict',
          ...mermaidConfigFor(themeStore.resolved, cssColorToHex),
        })
      : null;
    for (const block of Array.from(mermaidBlocks)) {
      if (!mermaid) break;
      const pre = block.parentElement as HTMLElement | null;
      if (!pre || pre.dataset.rendered === '1') continue;
      pre.dataset.rendered = '1';
      const code = (block.textContent || '').trim();
      const id = `plain-mmd-${++plainMermaidIdSeq}`;
      try {
        const { svg } = await mermaid.render(id, code);
        const wrap = document.createElement('div');
        wrap.className = 'plain-mermaid-block';
        wrap.innerHTML = svg;
        pre.replaceWith(wrap);
      } catch (e) {
        pre.classList.add('plain-block__broken');
        pre.textContent = `Mermaid error: ${(e as Error).message}`;
      }
    }

    const renderRoots = hostEl.querySelectorAll('.plain-block__render');
    for (const root of Array.from(renderRoots)) {
      await renderGraphvizBlocks(root, {
        theme: graphvizThemeFor(themeStore.mode),
        blockClass: 'plain-graphviz-block',
        errorClass: 'plain-block__broken',
      });
    }

    const tldrawBlocks = hostEl.querySelectorAll('.plain-block__render pre > code.language-tldraw');
    if (tldrawBlocks.length === 0) {
      // No boards to swap in — the remaining code blocks are final, so hand
      // them their copy buttons and stop here.
      attachPlainCodeCopyButtons(hostEl);
      return;
    }
    const { boardToSvg } = await import('../../../../lib/tldraw-runtime');
    const fences = findTldrawFences(plainText.value || '');
    const theme = {
      colorScheme: themeStore.mode,
      locale: settings.language || 'en',
    };
    for (const block of Array.from(tldrawBlocks)) {
      const pre = block.parentElement as HTMLElement | null;
      if (!pre || pre.dataset.rendered === '1') continue;
      pre.dataset.rendered = '1';
      const body = (block.textContent || '').trim();
      const fence = fences.find((item) => item.snapshot.trim() === body) ?? null;
      const wrap = document.createElement('div');
      wrap.className = 'plain-whiteboard-block';
      try {
        const svg = await boardToSvg(fence?.snapshot ?? body, theme);
        if (svg) {
          wrap.innerHTML = svg;
          if (fence?.boardId) {
            wrap.classList.add('plain-whiteboard-block--clickable');
            wrap.setAttribute('role', 'button');
            wrap.setAttribute('tabindex', '0');
            wrap.title = t('whiteboard.openFull');
            const openFull = () => {
              window.dispatchEvent(
                new CustomEvent('solomd:whiteboard-open', {
                  detail: { boardId: fence.boardId, tabId: props.tab.id, snapshot: fence.snapshot },
                }),
              );
            };
            wrap.addEventListener('click', openFull);
            wrap.addEventListener('keydown', (ev) => {
              if ((ev as KeyboardEvent).key === 'Enter' || (ev as KeyboardEvent).key === ' ') {
                ev.preventDefault();
                openFull();
              }
            });
          }
        } else {
          wrap.classList.add('plain-block__broken');
          wrap.textContent = t('whiteboard.empty');
        }
        pre.replaceWith(wrap);
      } catch {
        pre.classList.add('plain-block__broken');
        pre.textContent = t('whiteboard.loadFailed');
      }
    }

    attachPlainCodeCopyButtons(hostEl);
  }

  /**
   * v4.11.18 — give the Windows plain-block live editor the same one-click
   * copy button the preview pane has (#195). Runs after the mermaid /
   * PlantUML / tldraw passes have swapped their fences for rendered art, so
   * only real code blocks get a button. `renderMarkdown` has already stripped
   * the fence and any container indentation, so the button copies exactly the
   * code — never the leading spaces of a block nested in a list.
   */
  function attachPlainCodeCopyButtons(hostEl: HTMLElement) {
    attachCodeCopyButtons(hostEl, {
      label: t('toolbar.copy'),
      onError: (err) => toasts.error(`Copy failed: ${err}`),
    });
  }

  return {
    plainRenderCache,
    plainBlocks,
    renderPlainBlock,
    processPlainLiveRenderedBlocks,
    attachPlainCodeCopyButtons,
  };
}
