export interface ContextMenuItem { name: string; key?: string; onclick: () => void }

export const CONTEXT_MENU_SELECTOR = '.context-menu';

/** mind-elixir hides its menu only for built-in items; extend items must close it themselves. */
export function closingMenuItems(items: readonly ContextMenuItem[], hide: () => void): ContextMenuItem[] {
  return items.map((item) => ({
    name: item.name,
    key: item.key,
    onclick: () => {
      try {
        item.onclick();
      } finally {
        hide();
      }
    },
  }));
}

export function hideContextMenu(container: HTMLElement | null | undefined): void {
  const menu = container?.querySelector<HTMLElement>(CONTEXT_MENU_SELECTOR);
  if (menu) menu.hidden = true;
}
