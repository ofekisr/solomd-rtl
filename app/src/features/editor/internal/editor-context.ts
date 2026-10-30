import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { CitationEntry } from '../../../lib/citations.ts';
import type { Tab } from '../../../types.ts';
import type {
  EditorFeatureContext,
  EditorProps,
  SettingsStore,
} from '../contracts/editor-feature.port.ts';
import type { EditorFeatureRegistry } from './editor-feature-registry.service.ts';
import type { EditorFeaturesHost } from './useEditorFeatures.ts';

export interface EditorContextSources {
  props: EditorProps & { tab: Tab };
  settings: SettingsStore;
  themeMode(): 'light' | 'dark';
  t: EditorFeatureContext['t'];
  tabs: { setContent(id: string, text: string): void; tabs: Tab[]; activeId: string | null };
  toasts: EditorFeatureContext['toast'];
  view(): EditorView | null;
  citations(): CitationEntry[];
}

export type BoundEditorContext = EditorFeatureContext & {
  /** Wire `run` / `reconfigure` once `useEditorFeatures` has returned its host. */
  bind(host: EditorFeaturesHost, registry: EditorFeatureRegistry): void;
};

/** Pure over its sources (no vue import): pass the reactive `props` / store objects; every call reads them live. */
export function createEditorContext(sources: EditorContextSources): BoundEditorContext {
  let runner: EditorFeatureRegistry | null = null;
  let reconfigurer: ((slotKey: string, ext: Extension) => void) | null = null;
  const self: BoundEditorContext = {
    tab: () => sources.props.tab,
    props: () => ({
      focusMode: sources.props.focusMode,
      typewriterMode: sources.props.typewriterMode,
      spellCheck: sources.props.spellCheck,
    }),
    settings: sources.settings,
    themeMode: sources.themeMode,
    t: sources.t,
    setContent: (id, text) => sources.tabs.setContent(id, text),
    findTab: (id) => sources.tabs.tabs.find((t) => t.id === id),
    activeTabId: () => sources.tabs.activeId,
    toast: sources.toasts,
    view: sources.view,
    run: (command, ...args) => {
      if (!runner) throw new Error(`[editor] run(${command}) before bind()`);
      return runner.command(command)(self, ...args);
    },
    citations: sources.citations,
    reconfigure: (slotKey, ext) => reconfigurer?.(slotKey, ext),
    bind: (host, registry) => {
      runner = registry;
      reconfigurer = host.reconfigure;
    },
  };
  return self;
}
