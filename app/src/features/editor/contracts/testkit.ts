import { EditorState, type Extension, type TransactionSpec } from '@codemirror/state';
import type { EditorFeatureContext, EditorProps, ViewLike } from './editor-feature.port.ts';
import type { Tab } from '../../../types.ts';

export function stateWith(extensions: Extension, doc = '', selection?: { anchor: number; head?: number }): EditorState {
  return EditorState.create({ doc, extensions, selection });
}

export interface FakeView extends ViewLike { dispatched: TransactionSpec[]; focused: number }
export function fakeView(state: EditorState): FakeView {
  const fake = {
    state,
    dispatched: [] as TransactionSpec[],
    focused: 0,
    dispatch(...specs: TransactionSpec[]) {
      fake.dispatched.push(...specs);
      fake.state = fake.state.update(...specs).state;
    },
    focus() { fake.focused += 1; },
  };
  return fake as unknown as FakeView;
}

const TAB: Tab = { id: 't1', fileName: 'a.md', content: '', savedContent: '', encoding: 'utf-8', language: 'markdown', hadBom: false } as Tab;

export interface FakeContextInit extends Partial<Omit<EditorFeatureContext, 'settings' | 'props'>> {
  settings?: Record<string, unknown>;
  props?: Partial<EditorProps>;
  tabValue?: Partial<Tab>;
}
export type FakeContext = EditorFeatureContext & { toasts: string[]; contents: Array<[string, string]>; reconfigured: Array<[string, Extension]> };
export function fakeContext(init: FakeContextInit = {}): FakeContext {
  const { settings, props, tabValue, ...rest } = init;
  const toasts: string[] = [];
  const contents: Array<[string, string]> = [];
  const reconfigured: Array<[string, Extension]> = [];
  const tab = { ...TAB, ...tabValue } as Tab;
  return {
    tab: () => tab,
    props: () => ({ focusMode: false, typewriterMode: false, spellCheck: true, ...props }),
    settings: (settings ?? {}) as unknown as EditorFeatureContext['settings'],
    themeMode: () => 'light',
    t: (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key),
    setContent: (id, text) => { contents.push([id, text]); },
    findTab: (id) => (id === tab.id ? tab : undefined),
    activeTabId: () => tab.id,
    toast: { info: (m) => toasts.push(`info:${m}`), success: (m) => toasts.push(`success:${m}`), error: (m) => toasts.push(`error:${m}`) },
    view: () => null,
    run: (command) => { throw new Error(`fakeContext: no command ${command}`); },
    citations: () => [],
    reconfigure: (key, ext) => { reconfigured.push([key, ext]); },
    ...rest,
    toasts,
    contents,
    reconfigured,
  } as FakeContext;
}
