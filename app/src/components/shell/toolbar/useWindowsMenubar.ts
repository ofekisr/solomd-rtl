import { computed } from 'vue';
import { useI18n } from '../../../i18n';
import { useToolbarTips } from './useToolbarTips.ts';
import { buildMenubarMenus } from './windows-menubar-menus.ts';
import { type MenubarName, type ToolbarDropdowns } from './useToolbarDropdowns.ts';

const MENUBAR_NAMES: MenubarName[] = ['file', 'edit', 'view', 'help'];

/** Windows unified title bar: in-app menubar replacing the removed native one. */
export function useWindowsMenubar(dropdowns: ToolbarDropdowns) {
  const { t } = useI18n();
  const { chord } = useToolbarTips();
  const { menubarOpen, closeAllDropdowns, positionMenuFromButton } = dropdowns;

  function toggleMenubar(name: MenubarName, e: MouseEvent): void {
    const wasOpen = menubarOpen.value === name;
    closeAllDropdowns();
    if (wasOpen) return;
    positionMenuFromButton(e.currentTarget as HTMLElement);
    menubarOpen.value = name;
  }

  /** Native menubar behavior: once a menu is open, hovering a sibling switches. */
  function menubarHover(name: MenubarName, e: MouseEvent): void {
    if (menubarOpen.value && menubarOpen.value !== name) {
      positionMenuFromButton(e.currentTarget as HTMLElement);
      menubarOpen.value = name;
    }
  }

  function menuAction(id: string): void {
    menubarOpen.value = null;
    window.dispatchEvent(new CustomEvent('solomd:menu-action', { detail: id }));
  }

  const menubarMenus = computed(() => buildMenubarMenus(t, chord));

  return { menubarNames: MENUBAR_NAMES, menubarOpen, menubarMenus, toggleMenubar, menubarHover, menuAction };
}
