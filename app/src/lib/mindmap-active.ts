export interface MindmapHandle { run(actionId: string): boolean }

let active: MindmapHandle | null = null;

export function setActiveMindmap(handle: MindmapHandle): void {
  active = handle;
}

export function clearActiveMindmap(handle: MindmapHandle): void {
  if (active === handle) active = null;
}

export function runActiveMindmapAction(actionId: string): boolean {
  return active?.run(actionId) ?? false;
}
