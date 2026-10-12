import type { MindElixirInstance } from 'mind-elixir';
import { isHoverPanActive } from '../lib/mindmap-hover-pan';

const PAUSE_SELECTOR = '.mm-dock, .context-menu, #input-box';
const TOPIC_EDITOR_ID = 'input-box';
const PANNING_CLASS = 'mm-hover-panning';
const ALT_KEY = 'Alt';

export interface HoverPanOptions {
  readonly getMind: () => MindElixirInstance | null;
  readonly isToggled: () => boolean;
}

export interface HoverPan {
  attach(host: HTMLElement): void;
  detach(): void;
}

function isPausedBy(target: EventTarget | null): boolean {
  if (document.activeElement?.id === TOPIC_EDITOR_ID) return true;
  return target instanceof Element && target.closest(PAUSE_SELECTOR) !== null;
}

export function createHoverPan(options: HoverPanOptions): HoverPan {
  let host: HTMLElement | null = null;
  let isHovering = false;
  let isOverPause = false;

  function setCursor(isAltDown: boolean): void {
    const isActive = isHovering && !isOverPause && options.isToggled() !== isAltDown;
    host?.classList.toggle(PANNING_CLASS, isActive);
  }

  function onMove(event: PointerEvent): void {
    isHovering = true;
    isOverPause = isPausedBy(event.target);
    const state = { isToggled: options.isToggled(), isAltDown: event.altKey, pointerType: event.pointerType, buttons: event.buttons, isPaused: isOverPause };
    setCursor(event.altKey);
    if (!isHoverPanActive(state)) return;
    options.getMind()?.move(event.movementX, event.movementY);
  }

  function onLeave(): void {
    isHovering = false;
    setCursor(false);
  }

  function onKey(event: KeyboardEvent): void {
    if (event.key === ALT_KEY) setCursor(event.type === 'keydown');
  }

  function onBlur(): void {
    setCursor(false);
  }

  return {
    attach(el) {
      host = el;
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerleave', onLeave);
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);
      window.addEventListener('blur', onBlur);
    },
    detach() {
      host?.removeEventListener('pointermove', onMove);
      host?.removeEventListener('pointerleave', onLeave);
      host?.classList.remove(PANNING_CLASS);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', onBlur);
      host = null;
    },
  };
}
