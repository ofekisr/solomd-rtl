/**
 * image-overlay.ts — Fullscreen overlay viewer for images and diagrams.
 *
 * Opens when users click an `<img>` or Mermaid SVG in the preview pane.
 * Supports zoom (buttons, wheel, keyboard), pan (pointer drag), and
 * close (button, backdrop click, Escape).
 */

import {
  buildOverlayDom,
  type OverlayAction,
  type OverlayOptions,
  type OverlayStrings,
} from './overlay-dom.ts';
import { injectStyles } from './overlay-style.ts';
import { fitDisplaySize, naturalSizeOf } from './overlay-fit.ts';

export type { OverlayAction, OverlayOptions, OverlayStrings };

// ── Constants ───────────────────────────────────────────────────────

const ZOOM_STEP = 0.25;
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

// ── Singleton state ─────────────────────────────────────────────────

interface ActiveOverlay {
  backdrop: HTMLDivElement;
  viewport: HTMLDivElement;
  contentEl: HTMLDivElement;
  zoomPct: HTMLSpanElement;
  listeners: Array<{ el: EventTarget; type: string; fn: EventListener; capture: boolean }>;
  triggerEl: HTMLElement | null;
  didPan: boolean;
}

let active: ActiveOverlay | null = null;
let scale = 1;
let panX = 0;
let panY = 0;

// ── Listener tracking ───────────────────────────────────────────────

function on(
  el: EventTarget,
  type: string,
  fn: EventListener,
  opts?: AddEventListenerOptions,
) {
  el.addEventListener(type, fn, opts);
  active!.listeners.push({ el, type, fn, capture: !!opts?.capture });
}

function removeAllListeners() {
  if (!active) return;
  for (const { el, type, fn, capture } of active.listeners) {
    el.removeEventListener(type, fn, capture);
  }
  active.listeners.length = 0;
}

// ── Transform helpers ───────────────────────────────────────────────

function applyTransform() {
  if (!active) return;
  active.viewport.style.transform =
    `translate(${panX}px, ${panY}px) scale(${scale})`;
}

function updateZoomDisplay() {
  if (!active) return;
  active.zoomPct.textContent = `${Math.round(scale * 100)}%`;
}

function clampScale(s: number) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}

// ── Zoom logic ──────────────────────────────────────────────────────

function zoomTo(newScale: number) {
  scale = clampScale(newScale);
  applyTransform();
  updateZoomDisplay();
}

function zoomAt(newScale: number, clientX: number, clientY: number) {
  const clamped = clampScale(newScale);
  // Keep the point under the cursor fixed during zoom
  const vp = active!.viewport.getBoundingClientRect();
  const cx = clientX - vp.left;
  const cy = clientY - vp.top;
  const ratio = clamped / scale;
  panX = cx - ratio * (cx - panX);
  panY = cy - ratio * (cy - panY);
  scale = clamped;
  applyTransform();
  updateZoomDisplay();
}

function fitToScreen() {
  if (!active) return;
  const rect = active.contentEl.getBoundingClientRect();
  const child = active.viewport.firstElementChild as HTMLElement | null;
  if (!child) return;

  const { width: natW, height: natH } = naturalSizeOf(child);
  const { width: displayW, height: displayH } = fitDisplaySize(natW, natH, rect.width, rect.height);

  // Set CSS dimensions directly on the element — flexbox centers it
  child.style.width = `${displayW}px`;
  child.style.height = `${displayH}px`;

  // Reset user zoom/pan — content is already at the right size via CSS
  scale = 1;
  panX = 0;
  panY = 0;
  applyTransform();
  updateZoomDisplay();
}

// ── Close ───────────────────────────────────────────────────────────

function closeOverlay() {
  if (!active) return;
  removeAllListeners();
  active.backdrop.remove();
  if (active.triggerEl) {
    active.triggerEl.focus();
  }
  active = null;
}

// ── Open ────────────────────────────────────────────────────────────

export function openImageOverlay(opts: OverlayOptions) {
  if (active) closeOverlay();
  injectStyles();

  const dom = buildOverlayDom(opts);
  const { backdrop, closeBtn, contentEl, viewport, zoomPct, zoomInBtn, zoomOutBtn, resetBtn, actionBtns } = dom;

  // ── State ──

  scale = 1;
  panX = 0;
  panY = 0;

  active = {
    backdrop,
    viewport,
    contentEl,
    zoomPct,
    listeners: [],
    triggerEl: document.activeElement as HTMLElement | null,
    didPan: false,
  };

  document.body.appendChild(backdrop);

  // ── Event listeners ──

  // Close button
  on(closeBtn, 'click', ((e: MouseEvent) => {
    e.stopPropagation();
    closeOverlay();
  }) as EventListener);

  // Backdrop click (close only on direct backdrop hit, ignore post-pan clicks)
  on(backdrop, 'click', ((e: MouseEvent) => {
    if (active!.didPan) {
      active!.didPan = false;
      return;
    }
    if (e.target === backdrop || e.target === contentEl) {
      closeOverlay();
    }
  }) as EventListener);

  // Zoom buttons
  on(zoomInBtn, 'click', ((e: MouseEvent) => {
    e.stopPropagation();
    zoomTo(scale + ZOOM_STEP);
  }) as EventListener);

  on(zoomOutBtn, 'click', ((e: MouseEvent) => {
    e.stopPropagation();
    zoomTo(scale - ZOOM_STEP);
  }) as EventListener);

  on(resetBtn, 'click', ((e: MouseEvent) => {
    e.stopPropagation();
    fitToScreen();
  }) as EventListener);

  for (const [btn, action] of actionBtns) {
    on(btn, 'click', ((e: MouseEvent) => {
      e.stopPropagation();
      void action.onClick();
    }) as EventListener);
  }

  // Mouse wheel zoom
  on(contentEl, 'wheel', ((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    zoomAt(scale + delta, e.clientX, e.clientY);
  }) as EventListener, { passive: false });

  // Keyboard — on the window, in the capture phase. #339: the overlay is
  // opened from places that keep focus (a file-tree row, the editor), so a
  // listener on the backdrop only heard Escape once something inside the
  // overlay had been clicked. Capturing on the window also means the Escape
  // that closes the viewer is not seen again by the editor or the app shell
  // (leave focus mode, close the find bar, …) underneath it.
  on(window, 'keydown', ((e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeOverlay();
      return;
    }
    if (mod && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      zoomTo(scale + ZOOM_STEP);
      return;
    }
    if (mod && e.key === '-') {
      e.preventDefault();
      e.stopImmediatePropagation();
      zoomTo(scale - ZOOM_STEP);
      return;
    }
    if (mod && e.key === '0') {
      e.preventDefault();
      e.stopImmediatePropagation();
      fitToScreen();
      return;
    }
  }) as EventListener, { capture: true });

  // Pointer pan + pinch-to-zoom (touch).
  // Tracks every active pointer so two simultaneous touches can drive
  // a two-finger pinch gesture in addition to single-pointer pan.
  const pointers = new Map<number, { x: number; y: number }>();
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  function pinchDistance(): number {
    const pts = Array.from(pointers.values());
    if (pts.length < 2) return 0;
    const [a, b] = pts;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  on(contentEl, 'pointerdown', ((e: PointerEvent) => {
    if ((e.target as HTMLElement).closest('.io-header, .io-footer')) return;
    e.preventDefault();
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    contentEl.setPointerCapture(e.pointerId);
    if (pointers.size === 2) {
      pinchStartDist = pinchDistance();
      pinchStartScale = scale;
    } else {
      contentEl.style.cursor = 'grabbing';
    }
  }) as EventListener);

  on(contentEl, 'pointermove', ((e: PointerEvent) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const curr = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, curr);

    if (pointers.size >= 2) {
      // Pinch zoom — anchor at the midpoint of the two active pointers.
      const dist = pinchDistance();
      if (pinchStartDist > 0 && dist > 0) {
        const pts = Array.from(pointers.values());
        const cx = (pts[0].x + pts[1].x) / 2;
        const cy = (pts[0].y + pts[1].y) / 2;
        const target = pinchStartScale * (dist / pinchStartDist);
        zoomAt(target, cx, cy);
        active!.didPan = true;
      }
      return;
    }

    // Single-finger / mouse pan
    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) active!.didPan = true;
    panX += dx;
    panY += dy;
    applyTransform();
  }) as EventListener);

  function endPointer(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStartDist = 0;
    if (pointers.size === 0) contentEl.style.cursor = 'grab';
  }
  on(contentEl, 'pointerup', ((e: PointerEvent) => endPointer(e)) as EventListener);
  on(contentEl, 'pointercancel', ((e: PointerEvent) => endPointer(e)) as EventListener);

  // Prevent native image drag
  on(viewport, 'dragstart', ((e: DragEvent) => {
    e.preventDefault();
  }) as EventListener);

  // ── Initial fit ──
  requestAnimationFrame(() => fitToScreen());
}
