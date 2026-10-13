const MOUSE_POINTER = 'mouse';
const NO_BUTTONS = 0;

export interface HoverPanState {
  readonly isToggled: boolean;
  readonly isAltDown: boolean;
  readonly pointerType: string;
  readonly buttons: number;
  readonly isPaused: boolean;
}

export function isHoverPanActive(state: HoverPanState): boolean {
  if (state.isPaused || state.pointerType !== MOUSE_POINTER || state.buttons !== NO_BUTTONS) return false;
  return state.isToggled !== state.isAltDown;
}
