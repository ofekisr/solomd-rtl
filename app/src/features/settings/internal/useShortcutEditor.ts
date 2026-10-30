import { computed, onUnmounted, ref } from 'vue';
import { useI18n } from '../../../i18n';
import {
  activeKeyActions,
  combosFor,
  conflictFor,
  eventToCombo,
  filterKeyActions,
  formatCombo,
  interceptedBindings,
  MINDMAP_BUILTIN_OWNER,
  WRITER_PRESET,
  writerPresetActive,
  type KeyActionDef,
} from '../../../lib/keybindings';
import { builtinLabelFor } from '../../../lib/mindmap-keymap';
import { isMacOS } from '../../../lib/platform';
import { useSettingsStore } from '../../../stores/settings';
import { useToastsStore } from '../../../stores/toasts';

const KEY_CATEGORIES = ['file', 'edit', 'view', 'navigate', 'tools', 'mindmap'] as const;

/**
 * #180 — shortcut editor.
 *
 * Recording listens in the CAPTURE phase: the chord being recorded is usually
 * one the app itself binds (that is the whole point), and on the bubble phase
 * the global handler would have run the action before we saw the key.
 */
export function useShortcutEditor() {
  const { t } = useI18n();
  const settings = useSettingsStore();
  const toasts = useToastsStore();
  const macKeys = isMacOS();
  const recordingAction = ref<string | null>(null);
  const recordError = ref<string | null>(null);

  /** Prefer the command palette's own translation (`cmd.<id>`); the table's English label is the fallback for UI-only actions. */
  function actionLabel(action: KeyActionDef): string {
    const translated = t(`cmd.${action.id}`);
    return translated && translated !== `cmd.${action.id}` ? translated : action.label;
  }

  /** Sixty rows is past what anyone scans — filter by name, id or chord. */
  const keyQuery = ref('');
  const keyGroups = computed(() => {
    const hits = filterKeyActions(activeKeyActions(), keyQuery.value, actionLabel, settings.keybindings, macKeys);
    return KEY_CATEGORIES.map((key) => ({ key, items: hits.filter((a) => a.category === key) })).filter(
      (g) => g.items.length > 0,
    );
  });

  function actionCombos(action: KeyActionDef): string[] {
    return combosFor(action.id, settings.keybindings).map((c) => formatCombo(c, macKeys));
  }

  /** `in` is tracked by Vue's reactivity; `hasOwnProperty` is not (for a key that doesn't exist yet), which would leave Reset disabled after a rebind. */
  function isCustomised(action: KeyActionDef): boolean {
    return action.id in settings.keybindings;
  }

  /**
   * Shortcuts another program takes over before SoloMD sees them — AMD
   * Software's global hotkeys own most of the Ctrl+Shift row, Microsoft Pinyin
   * takes one more. Nothing can be detected at runtime (the chord never
   * arrives), so the panel names them and offers somewhere else to put the
   * commands. Empty on every platform but Windows, and empty once the user has
   * moved them.
   */
  const intercepted = computed(() => interceptedBindings(settings.keybindings));
  const interceptedIds = computed(() => new Set(intercepted.value.map((b) => b.action.id)));

  function interceptionFor(action: KeyActionDef) {
    return intercepted.value.find((b) => b.action.id === action.id) ?? null;
  }

  function applyHotkeyCompatPreset(): void {
    const moves = intercepted.value;
    for (const b of moves) settings.setKeybinding(b.action.id, b.alternative);
    toasts.success(t('settings.keysCompatApplied', { count: String(moves.length) }));
  }

  /**
   * #296 — ⌘B for bold is opt-in, not the default: it has toggled the file tree
   * since 1.0. The preset is a swap of two bindings, offered as one button so
   * nobody has to work out that freeing ⌘B means rebinding something else first.
   */
  const writerPresetOn = computed(() => writerPresetActive(settings.keybindings));
  const writerPresetKeys = computed(() => ({
    bold: formatCombo(WRITER_PRESET['fmt.bold'], macKeys),
    tree: formatCombo(WRITER_PRESET['view.toggleFileTree'], macKeys),
  }));
  function applyWriterPreset(): void {
    for (const [id, combo] of Object.entries(WRITER_PRESET)) settings.setKeybinding(id, combo);
    toasts.success(t('settings.keysWriterApplied', writerPresetKeys.value));
  }
  function undoWriterPreset(): void {
    for (const id of Object.keys(WRITER_PRESET)) settings.setKeybinding(id, undefined);
  }

  function startRecording(actionId: string): void {
    recordError.value = null;
    recordingAction.value = actionId;
    window.addEventListener('keydown', onRecordKey, true);
  }
  function stopRecording(): void {
    recordingAction.value = null;
    window.removeEventListener('keydown', onRecordKey, true);
  }

  function conflictMessage(combo: string, clash: string): string {
    const other = activeKeyActions().find((a) => a.id === clash);
    const action =
      clash === MINDMAP_BUILTIN_OWNER
        ? t('settings.keysMindmapBuiltin', { label: builtinLabelFor(combo) ?? combo })
        : other
          ? actionLabel(other)
          : clash;
    return t('settings.keysConflict', { combo: formatCombo(combo, macKeys), action });
  }

  function onRecordKey(e: KeyboardEvent): void {
    const id = recordingAction.value;
    if (!id) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'Escape') {
      stopRecording();
      return;
    }
    const combo = eventToCombo(e);
    if (!combo) return;
    const clash = conflictFor(combo, id, settings.keybindings);
    if (clash) {
      recordError.value = conflictMessage(combo, clash);
      return;
    }
    settings.setKeybinding(id, combo);
    stopRecording();
  }
  onUnmounted(stopRecording);

  return {
    macKeys,
    recordingAction,
    recordError,
    keyQuery,
    keyGroups,
    actionLabel,
    actionCombos,
    isCustomised,
    intercepted,
    interceptedIds,
    interceptionFor,
    applyHotkeyCompatPreset,
    writerPresetOn,
    writerPresetKeys,
    applyWriterPreset,
    undoWriterPreset,
    startRecording,
    stopRecording,
    formatCombo,
  };
}
