import type { MindElixirInstance } from 'mind-elixir';
import { FONT_STACKS, straightMainBranch, straightSubBranch, type ResolvedMapDisplay } from '../lib/mindmap-display';

const TEXT_COLOR_VARS: readonly string[] = ['--color', '--main-color', '--root-color'];

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

function applyText(mind: MindElixirInstance, display: ResolvedMapDisplay): void {
  const style = mind.container.style;
  for (const name of TEXT_COLOR_VARS) {
    if (display.textColor) style.setProperty(name, display.textColor);
    else style.removeProperty(name);
  }
  style.fontFamily = FONT_STACKS[display.font];
}

export function applyMapDisplay(mind: MindElixirInstance, display: ResolvedMapDisplay, original: BranchGenerators): void {
  applyBranchStyle(mind, display, original);
  applyText(mind, display);
  mind.changeCompact(display.compact);
  mind.linkDiv();
}
