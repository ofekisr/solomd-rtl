import type { MindElixirInstance } from 'mind-elixir';
import { mapThemeVariant, type ThemeFamily } from '../lib/mindmap-themes';
import { DEFAULT_NODE_GAP, FONT_STACKS, arrowMainBranch, arrowSubBranch, resolveMapDisplay, straightMainBranch, straightSubBranch, type BranchBox, type BranchStyle, type FoldedCountMode, type MapDisplay, type ResolvedMapDisplay } from '../lib/mindmap-display';

const FOLDED_COUNT_ATTR = 'data-folded-count';
const TEXT_COLOR_VARS: readonly string[] = ['--color', '--main-color'];

export interface BranchGenerators {
  main: MindElixirInstance['generateMainBranch'];
  sub: MindElixirInstance['generateSubBranch'];
}

export function captureBranchGenerators(mind: MindElixirInstance): BranchGenerators {
  return { main: mind.generateMainBranch, sub: mind.generateSubBranch };
}

type GeneratorPicker = (original: BranchGenerators) => BranchGenerators;

const NODE_GAP_VAR = '--node-gap-x';

function withNodeGap(pure: (box: BranchBox) => string): BranchGenerators['sub'] {
  return function (this: MindElixirInstance, box: BranchBox): string {
    const parsed = parseInt(this.container.style.getPropertyValue(NODE_GAP_VAR), 10);
    return pure({ ...box, gap: Number.isNaN(parsed) ? DEFAULT_NODE_GAP : parsed });
  } as BranchGenerators['sub'];
}

const GENERATORS_BY_STYLE: Readonly<Record<BranchStyle, GeneratorPicker>> = {
  curve: (original) => original,
  straight: () => ({ main: straightMainBranch, sub: withNodeGap(straightSubBranch) }),
  arrow: () => ({ main: arrowMainBranch, sub: withNodeGap(arrowSubBranch) }),
};

function applyBranchStyle(mind: MindElixirInstance, display: ResolvedMapDisplay, original: BranchGenerators): void {
  const picked = GENERATORS_BY_STYLE[display.branchStyle](original);
  mind.generateMainBranch = picked.main;
  mind.generateSubBranch = picked.sub;
}

function applyFoldedCount(mind: MindElixirInstance, mode: FoldedCountMode): void {
  mind.container.setAttribute(FOLDED_COUNT_ATTR, mode);
}

function applyText(mind: MindElixirInstance, display: ResolvedMapDisplay, hasExplicitFont: boolean): void {
  const style = mind.container.style;
  if (display.textColor) {
    for (const name of TEXT_COLOR_VARS) style.setProperty(name, display.textColor);
  }
  if (hasExplicitFont) style.fontFamily = FONT_STACKS[display.font];
  else style.removeProperty('font-family');
}

export function applyMapDisplay(mind: MindElixirInstance, display: ResolvedMapDisplay, original: BranchGenerators, hasExplicitFont: boolean, family: ThemeFamily): void {
  mind.changeTheme(mapThemeVariant(display.theme, family), false);
  if (mind.compact !== display.compact) mind.changeCompact(display.compact);
  applyBranchStyle(mind, display, original);
  applyText(mind, display, hasExplicitFont);
  applyFoldedCount(mind, display.foldedCount);
  mind.linkDiv();
}

export interface MapDisplayApplier {
  apply(mind: MindElixirInstance, override: MapDisplay, defaults: MapDisplay, family: ThemeFamily): void;
}

export function createMapDisplayApplier(): MapDisplayApplier {
  let owner: MindElixirInstance | null = null;
  let generators: BranchGenerators | null = null;
  return {
    apply(mind, override, defaults, family) {
      if (owner !== mind || !generators) {
        generators = captureBranchGenerators(mind);
        owner = mind;
      }
      const hasExplicitFont = override.font !== undefined || defaults.font !== undefined;
      applyMapDisplay(mind, resolveMapDisplay(override, defaults), generators, hasExplicitFont, family);
    },
  };
}
