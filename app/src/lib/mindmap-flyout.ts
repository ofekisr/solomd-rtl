export interface FlyoutState {
  readonly isOpen: boolean;
  readonly activeIndex: number;
}

export type FlyoutKey = 'ArrowDown' | 'ArrowUp' | 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End' | 'Escape';

export const CLOSED_FLYOUT: FlyoutState = { isOpen: false, activeIndex: -1 };
const NEXT_KEYS: readonly string[] = ['ArrowDown', 'ArrowRight'];
const PREVIOUS_KEYS: readonly string[] = ['ArrowUp', 'ArrowLeft'];

export function openFlyout(selectedIndex: number, count: number): FlyoutState {
  if (count === 0) return CLOSED_FLYOUT;
  return { isOpen: true, activeIndex: selectedIndex >= 0 && selectedIndex < count ? selectedIndex : 0 };
}

export function toggleFlyout(state: FlyoutState, selectedIndex: number, count: number): FlyoutState {
  return state.isOpen ? CLOSED_FLYOUT : openFlyout(selectedIndex, count);
}

function wrap(index: number, count: number): number {
  return (index + count) % count;
}

export function moveFlyout(state: FlyoutState, key: string, count: number): FlyoutState {
  if (!state.isOpen || count === 0) return state;
  if (key === 'Escape') return CLOSED_FLYOUT;
  if (NEXT_KEYS.includes(key)) return { ...state, activeIndex: wrap(state.activeIndex + 1, count) };
  if (PREVIOUS_KEYS.includes(key)) return { ...state, activeIndex: wrap(state.activeIndex - 1, count) };
  if (key === 'Home') return { ...state, activeIndex: 0 };
  if (key === 'End') return { ...state, activeIndex: count - 1 };
  return state;
}

export function isFlyoutKey(key: string): key is FlyoutKey {
  return [...NEXT_KEYS, ...PREVIOUS_KEYS, 'Home', 'End', 'Escape'].includes(key);
}
