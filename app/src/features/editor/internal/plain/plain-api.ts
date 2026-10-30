import type { ComputedRef, Ref } from 'vue';
import type { createPlainState } from './usePlainState.ts';
import type { usePlainGutter } from './usePlainGutter.ts';
import type { usePlainFolds } from './usePlainFolds.ts';
import type { usePlainRender } from './usePlainRender.ts';
import type { usePlainOverlays } from './usePlainOverlays.ts';
import type { usePlainFindBoxes } from './usePlainFindBoxes.ts';
import type { usePlainFind } from './usePlainFind.ts';
import type { usePlainAutocomplete } from './usePlainAutocomplete.ts';
import type { usePlainKeys } from './usePlainKeys.ts';
import type { usePlainBlockClicks } from './usePlainBlockClicks.ts';
import type { usePlainBlockEditing } from './usePlainBlockEditing.ts';
import type { usePlainContextMenu } from './usePlainContextMenu.ts';
import type { PlainBlock } from './plain-blocks.ts';

/** Functions and refs a composable reaches for before the composable that
 *  creates them exists; bound lazily through `late` / `lateRef`. */
export interface PlainLate {
  runPlainSearch(): void;
  activatePlainBlock(index: number, caret?: number, holdScroll?: boolean): void;
  autoSizePlainBlock(el: HTMLTextAreaElement): void;
  schedulePlainOverlays(): void;
  updatePlainFindBoxes(): void;
  plainFindBoxes: Ref<Array<{ top: number; left: number; width: number; height: number }>>;
  plainFindOpen: Ref<boolean>;
  plainBlocks: ComputedRef<PlainBlock[]>;
  updatePlainBlock(index: number, text: string, caret?: number): void;
  applyPlainFullEdit(next: string, absoluteCaret: number): void;
  enterPlainSelectAll(): void;
  maybeExitPlainSelectAll(): void;
  maybeOpenPlainAutocomplete(el: HTMLTextAreaElement): void;
  maybePlainTypewriterScroll(line: number): void;
  maybeTypewriterScroll(): void;
  syncPlainLiveScroll(): void;
}

export type PlainApiStage0 = PlainLate;
export type PlainApiStage1 = PlainApiStage0 & ReturnType<typeof createPlainState>;
export type PlainApiStage2 = PlainApiStage1 & ReturnType<typeof usePlainGutter>;
export type PlainApiStage3 = PlainApiStage2 & ReturnType<typeof usePlainFolds>;
export type PlainApiStage4 = PlainApiStage3 & ReturnType<typeof usePlainRender>;
export type PlainApiStage5 = PlainApiStage4 & ReturnType<typeof usePlainOverlays>;
export type PlainApiStage6 = PlainApiStage5 & ReturnType<typeof usePlainFindBoxes>;
export type PlainApiStage7 = PlainApiStage6 & ReturnType<typeof usePlainFind>;
export type PlainApiStage8 = PlainApiStage7 & ReturnType<typeof usePlainAutocomplete>;
export type PlainApiStage9 = PlainApiStage8 & ReturnType<typeof usePlainKeys>;
export type PlainApiStage10 = PlainApiStage9 & ReturnType<typeof usePlainBlockClicks>;
export type PlainApiStage11 = PlainApiStage10 & ReturnType<typeof usePlainBlockEditing>;
export type PlainApiStage12 = PlainApiStage11 & ReturnType<typeof usePlainContextMenu>;
export type PlainApi = PlainApiStage12;
