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

const MENU_LIST_SELECTOR = `${CONTEXT_MENU_SELECTOR} .menu-list`;
const GROUP_CLASS = 'mm-menu-group';
const GROUP_LIST_CLASS = 'mm-menu-group__list';
const GROUP_OPEN_CLASS = 'is-open';
const GROUP_FLIP_CLASS = 'is-flipped';

export interface GroupMenuItem extends ContextMenuItem {
  readonly removeLabel?: string;
  readonly onremove?: () => void;
}

type GroupItems = readonly GroupMenuItem[] | (() => readonly GroupMenuItem[]);

function removeButton(item: GroupMenuItem, hide: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `${GROUP_CLASS}__remove`;
  button.textContent = '×';
  button.title = item.removeLabel ?? '';
  button.setAttribute('aria-label', item.removeLabel ?? '');
  button.addEventListener('click', (e) => {
    e.stopPropagation();
    closingMenuItems([{ name: item.name, onclick: item.onremove! }], hide)[0].onclick();
  });
  return button;
}

function groupItemElement(item: GroupMenuItem, hide: () => void): HTMLLIElement {
  const li = document.createElement('li');
  const label = document.createElement('span');
  label.textContent = item.name;
  li.append(label);
  if (item.onremove) li.append(removeButton(item, hide));
  li.addEventListener('click', (e) => {
    e.stopPropagation();
    closingMenuItems([item], hide)[0].onclick();
  });
  return li;
}

function fitSubmenu(group: HTMLElement, list: HTMLElement): void {
  group.classList.remove(GROUP_FLIP_CLASS);
  list.style.top = '';
  const groupRect = group.getBoundingClientRect();
  const listRect = list.getBoundingClientRect();
  const isRtl = getComputedStyle(group).direction === 'rtl';
  const overflowsSide = isRtl ? listRect.left < 0 : listRect.right > window.innerWidth;
  if (overflowsSide) group.classList.add(GROUP_FLIP_CLASS);
  const overflowBottom = groupRect.top + listRect.height - window.innerHeight;
  if (overflowBottom > 0) list.style.top = `${-overflowBottom}px`;
}

/** Prepends a submenu row to mind-elixir's context menu; items close the menu like extend items do. */
/** Items may be a function so the submenu reflects current state (e.g. saved templates) each time it opens. */
export function installMenuGroup(container: HTMLElement, label: string, items: GroupItems, hide: () => void): void {
  const menu = container.querySelector<HTMLElement>(MENU_LIST_SELECTOR);
  if (!menu) return;
  const group = document.createElement('li');
  group.className = GROUP_CLASS;
  const title = document.createElement('span');
  title.textContent = label;
  const chevron = document.createElement('span');
  chevron.className = `${GROUP_CLASS}__chevron`;
  chevron.textContent = '›';
  const list = document.createElement('ul');
  list.className = GROUP_LIST_CLASS;
  const render = (): void => {
    const current = typeof items === 'function' ? items() : items;
    list.replaceChildren(...current.map((item) => groupItemElement(item, hide)));
  };
  render();
  group.append(title, chevron, list);
  group.addEventListener('mouseenter', () => {
    render();
    fitSubmenu(group, list);
  });
  group.addEventListener('click', () => {
    group.classList.toggle(GROUP_OPEN_CLASS);
    render();
    fitSubmenu(group, list);
  });
  menu.prepend(group);
}

/** mind-elixir bottom-aligns a menu taller than the space below the pointer, which can push its first rows off the top. */
export function keepMenuTopVisible(container: HTMLElement | null | undefined): void {
  const menu = container?.querySelector<HTMLElement>(MENU_LIST_SELECTOR);
  if (!menu || menu.getBoundingClientRect().top >= 0) return;
  menu.style.bottom = '';
  menu.style.top = '0px';
}
