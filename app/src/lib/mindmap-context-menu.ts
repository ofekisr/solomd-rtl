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

function groupItemElement(item: ContextMenuItem, hide: () => void): HTMLLIElement {
  const li = document.createElement('li');
  const label = document.createElement('span');
  label.textContent = item.name;
  li.append(label);
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
export function installMenuGroup(container: HTMLElement, label: string, items: readonly ContextMenuItem[], hide: () => void): void {
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
  list.append(...items.map((item) => groupItemElement(item, hide)));
  group.append(title, chevron, list);
  group.addEventListener('mouseenter', () => fitSubmenu(group, list));
  group.addEventListener('click', () => {
    group.classList.toggle(GROUP_OPEN_CLASS);
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
