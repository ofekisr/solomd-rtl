export interface SessionDeps {
  persistTabs(): void;
  persistTiles(): void;
  syncTilesFromTabs(activeTabId: string): void;
  validateTiles(): void;
  getFirstTabId(): string | undefined;
  hasFocusedActiveTab(): boolean;
  initDefaultTiles(firstTabId: string): void;
  syncActiveTab(): void;
}

export interface SessionService {
  persist(): void;
  persistTiles(): void;
  syncTilesFromTabs(activeTabId: string | null | undefined): void;
  initTiles(): void;
}

export function createSessionService(deps: SessionDeps): SessionService {
  return {
    persist() {
      deps.persistTabs();
      deps.persistTiles();
    },
    persistTiles() {
      deps.persistTiles();
    },
    syncTilesFromTabs(activeTabId) {
      if (activeTabId) deps.syncTilesFromTabs(activeTabId);
    },
    initTiles() {
      deps.validateTiles();
      const firstTabId = deps.getFirstTabId();
      if (!deps.hasFocusedActiveTab() && firstTabId !== undefined) {
        deps.initDefaultTiles(firstTabId);
      }
      deps.syncActiveTab();
    },
  };
}
