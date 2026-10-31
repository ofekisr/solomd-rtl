import type { MindElixirInstance } from 'mind-elixir';

const SECONDARY_BUTTON = 2;
const PRIMARY_MASK = 1;
const SECONDARY_MASK = 2;
const GRABBING_CLASS = 'mm-grabbing';
const CONTEXT_MENU_GRACE_MS = 300;

interface AreaLocation { x1: number; y1: number; x2: number; y2: number }
interface SelectionInternals { _areaLocation?: AreaLocation; getSelectionArea(): HTMLElement }

export interface ChordPanOptions {
  readonly getMind: () => MindElixirInstance | null;
}

export interface ChordPan {
  attach(host: HTMLElement): void;
  detach(): void;
}

function selectionOf(mind: MindElixirInstance | null): SelectionInternals | null {
  return (mind?.selection as unknown as SelectionInternals | undefined) ?? null;
}

function isSelecting(selection: SelectionInternals | null): boolean {
  return selection !== null && selection.getSelectionArea().style.display === 'block';
}

export function createChordPan(options: ChordPanOptions): ChordPan {
  let host: HTMLElement | null = null;
  let isChording = false;
  let blockMenuUntil = 0;

  function setGrabbing(isActive: boolean): void {
    host?.classList.toggle(GRABBING_CLASS, isActive);
  }

  function onDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button === SECONDARY_BUTTON) setGrabbing(true);
  }

  function shiftAnchor(selection: SelectionInternals, dx: number, dy: number): void {
    const area = selection._areaLocation;
    if (!area) return;
    area.x1 += dx;
    area.y1 += dy;
  }

  function onMove(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    const isSecondaryHeld = (event.buttons & SECONDARY_MASK) !== 0;
    if (!isSecondaryHeld) setGrabbing(false);
    const selection = selectionOf(options.getMind());
    isChording = isSecondaryHeld && isSelecting(selection);
    if (!isChording || !selection) return;
    blockMenuUntil = performance.now() + CONTEXT_MENU_GRACE_MS;
    options.getMind()?.move(event.movementX, event.movementY);
    shiftAnchor(selection, event.movementX, event.movementY);
  }

  function onUp(event: PointerEvent): void {
    if (event.buttons !== 0) return;
    isChording = false;
    setGrabbing(false);
  }

  function onMouseDown(event: MouseEvent): void {
    const isChordStart = event.button === SECONDARY_BUTTON && (event.buttons & PRIMARY_MASK) !== 0;
    if (!isChordStart || !isSelecting(selectionOf(options.getMind()))) return;
    blockMenuUntil = performance.now() + CONTEXT_MENU_GRACE_MS;
    setGrabbing(true);
    event.stopImmediatePropagation();
  }

  function onContextMenu(event: MouseEvent): void {
    const isBlocked = isChording || isSelecting(selectionOf(options.getMind())) || performance.now() < blockMenuUntil;
    if (!isBlocked) {
      setGrabbing(false);
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  return {
    attach(el) {
      host = el;
      el.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('mousedown', onMouseDown, true);
      window.addEventListener('contextmenu', onContextMenu, true);
    },
    detach() {
      host?.removeEventListener('pointerdown', onDown);
      host?.classList.remove(GRABBING_CLASS);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('mousedown', onMouseDown, true);
      window.removeEventListener('contextmenu', onContextMenu, true);
      host = null;
    },
  };
}
