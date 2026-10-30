import type { Ref } from 'vue';
import type { MindElixirInstance } from 'mind-elixir';
import { frameDelta, insetRect, panDelta, parseTranslate, type FrameRect } from '../lib/mindmap-frame';

const SMOOTH_MOVE_MS = 300;
const SMOOTH_MOVE_TRANSITION = `transform ${SMOOTH_MOVE_MS / 1000}s`;

function frameMap(instance: MindElixirInstance): void {
  const container = instance.container.getBoundingClientRect();
  if (container.width === 0 || container.height === 0) return;
  const padding = getComputedStyle(instance.nodes);
  const content = insetRect(instance.nodes.getBoundingClientRect(), parseFloat(padding.paddingLeft) || 0, parseFloat(padding.paddingTop) || 0);
  const root = instance.map.querySelector('me-root')?.getBoundingClientRect() ?? content;
  const { dx, dy } = frameDelta({ container, content, root, layout: instance.direction });
  const { x, y } = parseTranslate(instance.map.style.transform);
  instance.map.style.transform = `translate3d(${x + dx}px, ${y + dy}px, 0) scale(${instance.scaleVal})`;
}

export function wrapToCenter(instance: MindElixirInstance): void {
  const { toCenter } = instance;
  instance.toCenter = () => {
    toCenter.call(instance);
    frameMap(instance);
  };
}

function topicsRect(nodes: HTMLElement): FrameRect {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const topic of nodes.querySelectorAll('me-tpc')) {
    const rect = topic.getBoundingClientRect();
    if (rect.width === 0) continue;
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);
  }
  if (left === Infinity) return nodes.getBoundingClientRect();
  return { left, top, width: right - left, height: bottom - top };
}

export function wrapMove(instance: MindElixirInstance): void {
  instance.move = (dx, dy, smooth = false) => {
    const { map, container, nodes, scaleVal, bus } = instance;
    if (smooth && map.style.transition === SMOOTH_MOVE_TRANSITION) return false;
    const delta = panDelta({ container: container.getBoundingClientRect(), content: topicsRect(nodes), dx, dy });
    if (delta.dx === 0 && delta.dy === 0) return false;
    const { x, y } = parseTranslate(map.style.transform);
    if (smooth) {
      map.style.transition = SMOOTH_MOVE_TRANSITION;
      window.setTimeout(() => { map.style.transition = 'none'; }, SMOOTH_MOVE_MS);
    }
    map.style.transform = `translate3d(${x + delta.dx}px, ${y + delta.dy}px, 0) scale(${scaleVal})`;
    bus.fire('move', delta);
    return true;
  };
}

export interface ViewportDeps {
  getMind(): MindElixirInstance | null;
  host: Ref<HTMLElement | null>;
  stage: Ref<HTMLElement | null>;
}

export function useMindmapCanvasViewport(deps: ViewportDeps) {
  let centerObserver: ResizeObserver | null = null;

  function stopCentering(): void {
    centerObserver?.disconnect();
    centerObserver = null;
  }

  function centerOnceLaidOut(): void {
    stopCentering();
    if (!deps.host.value) return;
    centerObserver = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width === 0 || box.height === 0) return;
      stopCentering();
      deps.getMind()?.toCenter();
    });
    centerObserver.observe(deps.host.value);
  }

  function zoomBy(step: number): void {
    const mind = deps.getMind();
    if (mind) mind.scale(mind.scaleVal + step * mind.scaleSensitivity);
  }

  function toggleFullscreen(): void {
    if (document.fullscreenElement === deps.stage.value) void document.exitFullscreen();
    else void deps.stage.value?.requestFullscreen();
  }

  function recenter(): void {
    deps.getMind()?.toCenter();
  }

  function onFullscreenChange(): void {
    requestAnimationFrame(() => deps.getMind()?.toCenter());
  }

  return { stopCentering, centerOnceLaidOut, zoomBy, toggleFullscreen, recenter, onFullscreenChange };
}
