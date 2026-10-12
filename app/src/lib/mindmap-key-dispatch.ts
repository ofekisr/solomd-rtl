import { eventToCombo } from './keybindings.ts';
import { MINDMAP_BUILTIN_COMBOS } from './mindmap-keymap.ts';

export interface MapKeyDispatchContext {
  isIgnored(e: KeyboardEvent): boolean;
  getBindings(): Map<string, string>;
  canRunOn(actionId: string, e: KeyboardEvent): boolean;
  getAction(actionId: string): (() => void) | undefined;
  onChordFollowUp(): void;
}
export interface MapKeyDispatch {
  onCapture(e: KeyboardEvent): void;
  onBubble(e: KeyboardEvent): void;
}

const CHORD_PREFIX_COMBO = 'Mod+K';

export function createMapKeyDispatch(ctx: MapKeyDispatchContext): MapKeyDispatch {
  let wasChordPrefixPressed = false;

  function comboForMap(e: KeyboardEvent): string | null {
    const combo = eventToCombo(e);
    if (!combo || ctx.isIgnored(e)) return null;
    return combo;
  }

  function onCapture(e: KeyboardEvent): void {
    const combo = comboForMap(e);
    if (!combo) return;
    const isChordFollowUp = wasChordPrefixPressed;
    wasChordPrefixPressed = combo === CHORD_PREFIX_COMBO;
    if (isChordFollowUp) ctx.onChordFollowUp();
    const actionId = ctx.getBindings().get(combo);
    const run = actionId && ctx.canRunOn(actionId, e) ? ctx.getAction(actionId) : undefined;
    if (!run) return;
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) run();
  }

  function onBubble(e: KeyboardEvent): void {
    const combo = comboForMap(e);
    if (combo && MINDMAP_BUILTIN_COMBOS.has(combo)) e.stopPropagation();
  }

  return { onCapture, onBubble };
}
