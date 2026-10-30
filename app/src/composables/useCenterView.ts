/**
 * Which view fills the content area instead of the editor tiles (Wave 1b):
 * Bases, Inbox, a type lens or a saved view. Mutually exclusive, driven by
 * window events. Listeners register at setup from `App.vue`, so reading mode
 * still receives them.
 */
import { computed, inject, onBeforeUnmount, provide, ref, type InjectionKey } from 'vue';
import { BASES_OPEN_EVENT, BASES_CLOSE_EVENT } from './useBasesView';
import { INBOX_OPEN_EVENT, INBOX_CLOSE_EVENT } from './useInboxView';
import { TYPE_LENS_OPEN_EVENT, TYPE_LENS_CLOSE_EVENT } from './useTypeLens';
import { VIEW_OPEN_EVENT, VIEW_CLOSE_EVENT } from './useSavedViews';
import { useSavedViewsStore } from '../stores/savedViews';

export type CenterView = ReturnType<typeof buildCenterView>;

const CENTER_VIEW_KEY: InjectionKey<CenterView> = Symbol('centerView');

function buildCenterView() {
  const savedViews = useSavedViewsStore();
  const basesOpen = ref(false);
  const inboxViewOpen = ref(false);
  const typeLensOpen = ref(false);
  const typeLensName = ref('');
  const viewOpen = ref(false);

  /**
   * #245 — a saved view displaces the editor only while it exists. The store
   * nulls `activeView` when its slug vanishes on reload; without this guard the
   * content area rendered nothing and TileRoot stayed suppressed.
   */
  const viewPaneVisible = computed(() => viewOpen.value && !!savedViews.activeView);

  // The type-lens event fires before TypeLensView exists, so the name is passed down as a prop.
  function onOpenTypeLens(e: Event): void {
    const name = (e as CustomEvent).detail?.typeName;
    if (typeof name !== 'string' || !name) return;
    typeLensName.value = name;
    typeLensOpen.value = true;
    basesOpen.value = false;
    inboxViewOpen.value = false;
    viewOpen.value = false;
  }

  const handlers: Array<[string, EventListener]> = [
    [BASES_OPEN_EVENT, () => { basesOpen.value = true; viewOpen.value = false; typeLensOpen.value = false; }],
    [BASES_CLOSE_EVENT, () => { basesOpen.value = false; }],
    [INBOX_OPEN_EVENT, () => { inboxViewOpen.value = true; typeLensOpen.value = false; }],
    [INBOX_CLOSE_EVENT, () => { inboxViewOpen.value = false; }],
    [TYPE_LENS_OPEN_EVENT, onOpenTypeLens],
    [TYPE_LENS_CLOSE_EVENT, () => { typeLensOpen.value = false; }],
    [VIEW_OPEN_EVENT, () => { viewOpen.value = true; basesOpen.value = false; typeLensOpen.value = false; }],
    [VIEW_CLOSE_EVENT, () => { viewOpen.value = false; }],
  ];
  for (const [name, handler] of handlers) window.addEventListener(name, handler);
  onBeforeUnmount(() => {
    for (const [name, handler] of handlers) window.removeEventListener(name, handler);
  });

  return { basesOpen, inboxViewOpen, typeLensOpen, typeLensName, viewPaneVisible };
}

export function createCenterView(): CenterView {
  const view = buildCenterView();
  provide(CENTER_VIEW_KEY, view);
  return view;
}

export function useCenterView(): CenterView {
  const view = inject(CENTER_VIEW_KEY);
  if (!view) throw new Error('useCenterView() called outside createCenterView()');
  return view;
}
