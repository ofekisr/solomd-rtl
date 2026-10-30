import type { Ref } from 'vue';
import { installSvgImageFallbacks } from '../lib/image-resolve';
import { openImageOverlay, type OverlayStrings } from '../lib/image-overlay';
import { svgToPngBlob, diagramBackground } from '../lib/mermaid-export';
import { clipboardPort, dialogPort, fsPort } from '../platform/index.ts';
import { useToastsStore } from '../stores/toasts';
import { useI18n } from '../i18n';
import { attachCodeCopyButtons as attachSharedCodeCopyButtons } from '../lib/code-copy';
import { attachPreviewFolds } from '../lib/preview-heading-fold';

export interface PreviewOverlayProps { filePath?: string; tabId?: string }

export function usePreviewOverlays(host: Ref<HTMLDivElement | null>, props: PreviewOverlayProps) {
  const { t } = useI18n();
  const previewFoldsByDoc = new Map<string, Set<string>>();

  function overlayStrings(): OverlayStrings {
    return {
      close: t('overlay.close'),
      zoomIn: t('overlay.zoomIn'),
      zoomOut: t('overlay.zoomOut'),
      resetZoom: t('overlay.resetZoom'),
      image: t('overlay.image'),
      diagram: t('overlay.diagram'),
    };
  }

  function attachImageOverlayHandlers() {
    if (!host.value) return;

    installSvgImageFallbacks(host.value);

    const images = host.value.querySelectorAll('img');
    for (const img of Array.from(images)) {
      if ((img as HTMLElement).dataset.overlayBound === '1') continue;
      (img as HTMLElement).dataset.overlayBound = '1';
      img.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        openImageOverlay({
          source: img,
          title: img.alt || img.getAttribute('src') || undefined,
          strings: overlayStrings(),
        });
      });
    }

    const blocks = host.value.querySelectorAll('.mermaid-block, .graphviz-block');
    for (const block of Array.from(blocks)) {
      if ((block as HTMLElement).dataset.overlayBound === '1') continue;
      (block as HTMLElement).dataset.overlayBound = '1';
      block.addEventListener('click', ((e: MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        const svg = block.querySelector('svg');
        if (!svg) return;
        openImageOverlay({
          source: svg,
          strings: overlayStrings(),
          // #162 — Mermaid renders as inline SVG, so the WebView's own
          // "save image as" only offers HTML; give diagrams real PNG actions.
          actions: [
            { label: t('overlay.exportPng'), onClick: () => exportDiagramPng(svg) },
            { label: t('overlay.copyImage'), onClick: () => copyDiagramPng(svg) },
          ],
        });
      }) as EventListener);
    }
  }

  // #195 — fenced code blocks get a stable, one-click copy affordance. The
  // implementation lives in lib/code-copy.ts so the live-edit editor and the
  // Windows plain-block editor render the exact same button (v4.11.18).
  function attachCodeCopyButtons() {
    if (!host.value) return;
    attachSharedCodeCopyButtons(host.value, {
      label: t('toolbar.copy'),
      onError: (err) => useToastsStore().error(`Copy failed: ${err}`),
    });
  }

  function attachHeadingFolds() {
    if (!host.value) return;
    const docKey = props.filePath || props.tabId || '';
    let folded = previewFoldsByDoc.get(docKey);
    if (!folded) {
      folded = new Set<string>();
      previewFoldsByDoc.set(docKey, folded);
    }
    attachPreviewFolds(host.value, { folded, label: t('previewFold.toggle') });
  }

  // ── #162: single-diagram PNG export / copy ──────────────────────────

  function diagramExportName(): string {
    const base = props.filePath?.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '');
    return base ? `${base}-diagram.png` : 'diagram.png';
  }

  async function exportDiagramPng(svg: SVGElement) {
    const toasts = useToastsStore();
    try {
      const blob = await svgToPngBlob(svg, { scale: 2, background: diagramBackground() });
      const path = await dialogPort.save({
        defaultPath: diagramExportName(),
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      });
      if (!path) return;
      const buffer = new Uint8Array(await blob.arrayBuffer());
      await fsPort.writeBinaryFile({ path, data: Array.from(buffer) });
      toasts.success(`Saved ${path.split(/[\\/]/).pop()}`);
    } catch (err) {
      toasts.error(`Export failed: ${err}`);
    }
  }

  async function copyDiagramPng(svg: SVGElement) {
    const toasts = useToastsStore();
    try {
      const blob = await svgToPngBlob(svg, { scale: 2, background: diagramBackground() });
      try {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
      } catch {
        // WKWebView denies navigator.clipboard outside a user gesture /
        // focused document — same fallback as useExport.copyAsImage.
        const img = await clipboardPort.imageFromBytes(new Uint8Array(await blob.arrayBuffer()));
        await clipboardPort.writeImage(img);
      }
      toasts.success(t('overlay.copyImage') + ' ✓');
    } catch (err) {
      toasts.error(`Copy failed: ${err}`);
    }
  }

  function attachPostRender(): void {
    attachImageOverlayHandlers();
    attachCodeCopyButtons();
    attachHeadingFolds();
  }

  return { attachPostRender };
}
