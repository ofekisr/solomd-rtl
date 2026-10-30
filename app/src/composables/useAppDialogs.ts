/**
 * Open state for every app-level modal (Wave 1b). `App.vue` creates it;
 * `AppDialogs.vue` and `AppLayout.vue` read it through `useAppDialogs()`.
 */
import { inject, provide, ref, watchEffect, type InjectionKey } from 'vue';
import { aiPort } from '../platform/index.ts';
import { useSettingsStore } from '../stores/settings';
import { useTilesStore } from '../stores/tiles';

export type UnsavedAction = 'save' | 'discard' | 'cancel';
export type FileChangedAction = 'reload' | 'overwrite' | 'cancel';

export type AppDialogs = ReturnType<typeof buildAppDialogs>;

const APP_DIALOGS_KEY: InjectionKey<AppDialogs> = Symbol('appDialogs');

function buildUnsavedDialog() {
  const isOpen = ref(false);
  const mode = ref<'tab' | 'window'>('tab');
  const fileName = ref('');
  const count = ref(0);
  let resolveAction: ((action: UnsavedAction) => void) | null = null;

  function show(nextMode: 'tab' | 'window', nextFileName: string, nextCount: number): Promise<UnsavedAction> {
    mode.value = nextMode;
    fileName.value = nextFileName;
    count.value = nextCount;
    isOpen.value = true;
    return new Promise((resolve) => {
      resolveAction = resolve;
    });
  }

  function answer(action: UnsavedAction): void {
    isOpen.value = false;
    resolveAction?.(action);
    resolveAction = null;
  }

  return { isOpen, mode, fileName, count, show, answer };
}

function buildFileChangedDialog() {
  const isOpen = ref(false);
  const fileName = ref('');
  let resolveAction: ((action: FileChangedAction) => void) | null = null;

  function show(nextFileName: string): Promise<FileChangedAction> {
    fileName.value = nextFileName;
    isOpen.value = true;
    return new Promise((resolve) => {
      resolveAction = resolve;
    });
  }

  function answer(action: FileChangedAction): void {
    isOpen.value = false;
    resolveAction?.(action);
    resolveAction = null;
  }

  return { isOpen, fileName, show, answer };
}

function buildAiKeyStatus() {
  const settings = useSettingsStore();
  const hasKey = ref(false);

  async function refresh(): Promise<void> {
    if (!settings.aiEnabled) {
      hasKey.value = false;
      return;
    }
    try {
      hasKey.value = await aiPort.aiHasKey({ provider: settings.aiProvider });
    } catch {
      hasKey.value = false;
    }
  }

  watchEffect(() => {
    void settings.aiEnabled;
    void settings.aiProvider;
    refresh();
  });

  return { hasKey, refresh };
}

function buildAppDialogs() {
  const tiles = useTilesStore();
  const settingsOpen = ref(false);
  // SettingsPanel watches this to land on a category (e.g. AI button → `integrations`).
  const settingsInitialSection = ref<string | null>(null);
  const imageUrlDialogOpen = ref(false);

  function openSettingsAt(section: string | null = null): void {
    settingsInitialSection.value = section;
    settingsOpen.value = true;
  }

  function onOpenSettingsEvent(e: Event): void {
    openSettingsAt((e as CustomEvent).detail?.section ?? null);
  }

  /** Confirmed URL goes to the focused pane's editor. */
  function onImageUrlConfirm(url: string, alt: string): void {
    imageUrlDialogOpen.value = false;
    window.dispatchEvent(
      new CustomEvent('solomd:insert-image-url', { detail: { url, alt, paneId: tiles.focusedPaneId } }),
    );
  }

  return {
    paletteOpen: ref(false),
    quickSwitcherOpen: ref(false),
    settingsOpen,
    settingsInitialSection,
    openSettingsAt,
    onOpenSettingsEvent,
    helpOpen: ref(false),
    ragSearchOpen: ref(false),
    cjkProofreadOpen: ref(false),
    aboutOpen: ref(false),
    wizardOpen: ref(false),
    imageUrlDialogOpen,
    onOpenImageUrlDialog: () => {
      imageUrlDialogOpen.value = true;
    },
    onImageUrlConfirm,
    // #148 / #151 — Android real-folder vault picker, and the restart prompt
    // shown when an all-files grant has not taken effect on this process.
    androidPickerOpen: ref(false),
    androidRestartNeeded: ref(false),
    unsaved: buildUnsavedDialog(),
    fileChanged: buildFileChangedDialog(),
    aiKey: buildAiKeyStatus(),
  };
}

export function createAppDialogs(): AppDialogs {
  const dialogs = buildAppDialogs();
  provide(APP_DIALOGS_KEY, dialogs);
  return dialogs;
}

export function useAppDialogs(): AppDialogs {
  const dialogs = inject(APP_DIALOGS_KEY);
  if (!dialogs) throw new Error('useAppDialogs() called outside createAppDialogs()');
  return dialogs;
}
