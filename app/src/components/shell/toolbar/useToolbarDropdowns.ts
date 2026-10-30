import { computed, inject, onBeforeUnmount, onMounted, ref, type InjectionKey, type Ref } from 'vue';

export type MenubarName = 'file' | 'edit' | 'view' | 'help';
export type DropdownName = 'new' | 'recent' | 'export' | 'insert';

type MenuPos = { top: number; left?: number; right?: number };

const MENU_GAP_PX = 4;
const MENU_EDGE_PX = 8;
const MENU_RIGHT_MARGIN_PX = 16;
const MENU_Z_INDEX = 1000;

/** Exclusive dropdown state shared by the file group, insert menu, pomodoro popover and Windows menubar. */
export function useToolbarDropdowns(toolbarRef: Ref<HTMLElement | null>) {
  const recentOpen = ref(false);
  const exportOpen = ref(false);
  const newOpen = ref(false);
  const insertOpen = ref(false);
  const pomoOpen = ref(false);
  const menubarOpen = ref<MenubarName | null>(null);

  const newBtnRef = ref<HTMLElement | null>(null);
  const recentBtnRef = ref<HTMLElement | null>(null);
  const exportBtnRef = ref<HTMLElement | null>(null);
  const insertBtnRef = ref<HTMLElement | null>(null);
  const menuPos = ref<MenuPos | null>(null);

  const floatStyle = computed<Record<string, string | number> | undefined>(() => {
    if (!menuPos.value) return undefined;
    const s: Record<string, string | number> = {
      position: 'fixed',
      top: `${menuPos.value.top}px`,
      zIndex: MENU_Z_INDEX,
      // #320 — as tall as the window allows; still scrolls when the window is too short.
      maxHeight: `calc(100vh - ${menuPos.value.top}px - ${MENU_EDGE_PX}px)`,
    };
    if (menuPos.value.left !== undefined) s.left = `${menuPos.value.left}px`;
    if (menuPos.value.right !== undefined) s.right = `${menuPos.value.right}px`;
    return s;
  });

  function positionMenuFromButton(btn: HTMLElement | null, align: 'left' | 'right' = 'left'): void {
    if (!btn) { menuPos.value = null; return; }
    const rect = btn.getBoundingClientRect();
    const top = rect.bottom + MENU_GAP_PX;
    menuPos.value = align === 'right'
      ? { top, right: Math.max(MENU_EDGE_PX, window.innerWidth - rect.right) }
      : { top, left: Math.min(rect.left, window.innerWidth - MENU_RIGHT_MARGIN_PX) };
  }

  function closeAllDropdowns(): void {
    newOpen.value = false;
    recentOpen.value = false;
    exportOpen.value = false;
    insertOpen.value = false;
    pomoOpen.value = false;
    menubarOpen.value = null;
  }

  function togglePomo(): void {
    closeAllDropdowns();
    pomoOpen.value = !pomoOpen.value;
  }

  const openFlags: Record<DropdownName, Ref<boolean>> = {
    new: newOpen, recent: recentOpen, export: exportOpen, insert: insertOpen,
  };
  const buttonRefs: Record<DropdownName, Ref<HTMLElement | null>> = {
    new: newBtnRef, recent: recentBtnRef, export: exportBtnRef, insert: insertBtnRef,
  };

  function toggleDropdown(name: DropdownName): void {
    const wasOpen = openFlags[name].value;
    closeAllDropdowns();
    if (wasOpen) return;
    positionMenuFromButton(buttonRefs[name].value);
    openFlags[name].value = true;
  }

  function onDocClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (target && (target.closest('.dropdown') || target.closest('.dropdown__menu'))) return;
    closeAllDropdowns();
  }
  function onViewportChange(): void {
    closeAllDropdowns();
  }
  /** #221(3) — only a scroll that can move the anchor buttons invalidates the teleported menu. */
  function onScrollAnywhere(e: Event): void {
    const t = e.target as Node | null;
    if (t && t !== document && toolbarRef.value && !toolbarRef.value.contains(t)) return;
    closeAllDropdowns();
  }

  onMounted(() => {
    document.addEventListener('click', onDocClick, true);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onScrollAnywhere, true);
  });
  onBeforeUnmount(() => {
    document.removeEventListener('click', onDocClick, true);
    window.removeEventListener('resize', onViewportChange);
    window.removeEventListener('scroll', onScrollAnywhere, true);
  });

  return {
    recentOpen, exportOpen, newOpen, insertOpen, pomoOpen, menubarOpen,
    newBtnRef, recentBtnRef, exportBtnRef, insertBtnRef,
    floatStyle, positionMenuFromButton, closeAllDropdowns, toggleDropdown, togglePomo,
  };
}

export type ToolbarDropdowns = ReturnType<typeof useToolbarDropdowns>;
export const TOOLBAR_DROPDOWNS: InjectionKey<ToolbarDropdowns> = Symbol('toolbar-dropdowns');

export function useInjectedDropdowns(): ToolbarDropdowns {
  const dropdowns = inject(TOOLBAR_DROPDOWNS);
  if (!dropdowns) throw new Error('TOOLBAR_DROPDOWNS not provided');
  return dropdowns;
}
