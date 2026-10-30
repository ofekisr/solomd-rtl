import type { Compartment, Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { z } from 'zod';
import type { useSettingsStore } from '../../../stores/settings.ts';
import type { Tab } from '../../../types.ts';
import type { CitationEntry } from '../../../lib/citations.ts';
import type { I18nKey } from '../../../i18n/keys.ts';
import type { SettingsKey } from '../../settings/contracts/index.ts';

/** Today's buildExtensions() positions, in order (Editor.vue 3026-3145). ADR 0004. */
export const EXTENSION_SLOTS = [
  'ime-guard', 'history', 'direction', 'drag-aware', 'cursor', 'active-line', 'selection-tools',
  'search', 'keymap', 'line-numbers', 'wrap', 'language', 'rich', 'theme', 'vim', 'font',
  'spellcheck-attr', 'ai-lock', 'focus', 'typewriter', 'image-paste', 'md-completion', 'ai-key',
  'md-spellcheck', 'slash', 'task-list', 'fold', 'session', 'stable-click', 'update-listener',
] as const;
export type ExtensionSlot = (typeof EXTENSION_SLOTS)[number];

export type SettingsStore = ReturnType<typeof useSettingsStore>;
export type ViewLike = Pick<EditorView, 'state' | 'dispatch' | 'focus'>;

export interface EditorProps {
  focusMode: boolean;
  typewriterMode: boolean;
  spellCheck: boolean;
}

export interface EditorFeatureContext {
  tab(): Tab;
  props(): EditorProps;
  readonly settings: SettingsStore;
  themeMode(): 'light' | 'dark';
  t(key: string, params?: Record<string, string | number>): string;
  setContent(tabId: string, text: string): void;
  findTab(id: string): Tab | undefined;
  activeTabId(): string | null;
  readonly toast: { info(m: string): void; success(m: string): void; error(m: string): void };
  view(): EditorView | null;
  /** Run another feature's command (e.g. image-upload → format's insertMarkdown). */
  run(command: string, ...args: unknown[]): unknown;
  /** Bibliography entries for @-completion (host loads them; both engines read them). */
  citations(): CitationEntry[];
  /** Reconfigure a slot's compartment on the live view (slot key = `${featureId}:${slot}`); no-op without a view. */
  reconfigure(slotKey: string, ext: Extension): void;
}

export interface ReconfigurableSlot {
  readonly slot: ExtensionSlot;
  deps(ctx: EditorFeatureContext): unknown;
  build(ctx: EditorFeatureContext): Extension;
  when?(ctx: EditorFeatureContext): boolean;
  after?(ctx: EditorFeatureContext, view: EditorView | null): void;
}

export interface FeatureWatch {
  deps(ctx: EditorFeatureContext): unknown;
  run(ctx: EditorFeatureContext, view: EditorView | null): void;
}

type Bivariant<F extends (...args: never[]) => unknown> = { fn(...args: Parameters<F>): ReturnType<F> }['fn'];
export type EditorCommand = Bivariant<(ctx: EditorFeatureContext, ...args: unknown[]) => unknown>;

export interface TabSwitch { oldId?: string; newId: string }

export interface EditorFeature {
  readonly id: string;
  readonly settingsKeys: readonly SettingsKey[];
  readonly i18nKeys: readonly I18nKey[];
  readonly extensions?: Partial<Record<ExtensionSlot, (ctx: EditorFeatureContext) => Extension>>;
  readonly slots?: readonly ReconfigurableSlot[];
  readonly watches?: readonly FeatureWatch[];
  readonly commands?: Readonly<Record<string, EditorCommand>>;
  setup?(ctx: EditorFeatureContext): void | (() => void);
  onMount?(ctx: EditorFeatureContext, view: EditorView): void;
  /** Tab switch, before the host replaces the state (old doc still in the view). */
  beforeTabSwitch?(ctx: EditorFeatureContext, view: EditorView, ids: TabSwitch): void;
  /** Tab switch, after the host replaced the state. */
  onTabSwitch?(ctx: EditorFeatureContext, view: EditorView, ids: TabSwitch): void;
  onUnmount?(ctx: EditorFeatureContext, view: EditorView): void;
}

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
export const EditorFeatureManifestSchema = z.object({
  id: z.string().regex(KEBAB),
  settingsKeys: z.array(z.string().min(1)),
  i18nKeys: z.array(z.string().min(1)),
});

export type CompartmentFor = (key: string) => Compartment;
