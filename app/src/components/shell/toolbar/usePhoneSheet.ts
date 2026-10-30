import { ref, type Ref } from 'vue';

/**
 * #168 phone toolbar: the strip folds into a labelled sheet behind "more".
 * #282 — on a desktop window the sheet must NOT collapse after an action; it
 * stays until the control that opened it is pressed again.
 */
export function usePhoneSheet(isNarrow: Ref<boolean>) {
  const sheetOpen = ref(false);

  function toggleSheet(): void {
    sheetOpen.value = !sheetOpen.value;
  }

  function onToolbarActivate(e: Event): void {
    if (!sheetOpen.value || !isNarrow.value) return;
    const el = e.target as HTMLElement | null;
    if (el?.closest('[data-phone-more]')) return;
    if (el?.closest('button, [role="menuitem"], a')) sheetOpen.value = false;
  }

  return { sheetOpen, toggleSheet, onToolbarActivate };
}
