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

const TOPIC_SELECTOR = 'me-tpc';
const SELECTED_CLASS = 'selected';

interface TopicLike { classList: { contains(name: string): boolean } }
interface TargetLike { closest(selector: string): TopicLike | null }

/** mind-elixir selects on right-click only when the target is the topic itself, not its inner text; this finds the topic to select. */
export function unselectedTopicAt<T extends TopicLike>(target: TargetLike | null): T | null {
  const topic = target?.closest(TOPIC_SELECTOR) ?? null;
  return topic && !topic.classList.contains(SELECTED_CLASS) ? (topic as T) : null;
}
