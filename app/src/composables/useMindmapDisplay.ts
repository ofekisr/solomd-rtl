import type { MindElixirInstance } from 'mind-elixir';
import { mapThemeVariant, type ThemeFamily } from '../lib/mindmap-themes';
import { FONT_STACKS, resolveMapDisplay, straightMainBranch, straightSubBranch, type MapDisplay, type ResolvedMapDisplay } from '../lib/mindmap-display';

const TEXT_COLOR_VARS: readonly string[] = ['--color', '--main-color'];

export interface BranchGenerators {
  main: MindElixirInstance['generateMainBranch'];
  sub: MindElixirInstance['generateSubBranch'];
}

export function captureBranchGenerators(mind: MindElixirInstance): BranchGenerators {
  return { main: mind.generateMainBranch, sub: mind.generateSubBranch };
}

function applyBranchStyle(mind: MindElixirInstance, display: ResolvedMapDisplay, original: BranchGenerators): void {
  const isStraight = display.branchStyle === 'straight';
  mind.generateMainBranch = isStraight ? straightMainBranch : original.main;
  mind.generateSubBranch = isStraight ? straightSubBranch : original.sub;
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
