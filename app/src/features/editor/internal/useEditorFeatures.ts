import { onScopeDispose, watch } from 'vue';
import { Compartment, type Extension, type StateEffect } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type {
  EditorFeatureContext,
  TabSwitch,
} from '../contracts/editor-feature.port.ts';
import type { EditorFeatureRegistry } from './editor-feature-registry.service.ts';

export interface EditorFeaturesHost {
  extensions(): Extension[];
  run(name: string, ...args: unknown[]): unknown;
  mount(view: EditorView): void;
  beforeSwitchTab(view: EditorView, ids: TabSwitch): void;
  switchTab(view: EditorView, ids: TabSwitch): void;
  unmount(view: EditorView): void;
  reconfigure(slotKey: string, ext: Extension): void;
}

function isSame(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  }
  return Object.is(a, b);
}

function runSetups(registry: EditorFeatureRegistry, ctx: EditorFeatureContext): void {
  for (const f of registry.features) {
    const cleanup = f.setup?.(ctx);
    if (cleanup) onScopeDispose(cleanup);
  }
}

function watchSlots(
  registry: EditorFeatureRegistry,
  ctx: EditorFeatureContext,
  compartmentFor: (key: string) => Compartment,
): void {
  watch(
    () => [ctx.tab().id, registry.slots.map((s) => s.spec.deps(ctx))] as const,
    ([id, next], [prevId, prev]) => {
      // A tab switch rebuilds every compartment through setState, and onTabSwitch hooks cover the side effects.
      // Dispatching here would hit the outgoing doc before useCmTabSwitch snapshots its caret and scroll.
      if (id !== prevId) return;
      const changed = registry.slots.filter((_, i) => !isSame(next[i], prev[i]));
      const view = ctx.view();
      if (view) {
        const effects: StateEffect<unknown>[] = changed
          .filter((s) => compartmentFor(s.key).get(view.state) !== undefined)
          .map((s) => compartmentFor(s.key).reconfigure(s.spec.build(ctx)));
        if (effects.length > 0) view.dispatch({ effects });
      }
      for (const s of changed) s.spec.after?.(ctx, ctx.view());
    },
  );
}

function watchFeatures(registry: EditorFeatureRegistry, ctx: EditorFeatureContext): void {
  for (const w of registry.watches) {
    watch(() => w.deps(ctx), () => w.run(ctx, ctx.view()));
  }
}

export function useEditorFeatures(registry: EditorFeatureRegistry, ctx: EditorFeatureContext): EditorFeaturesHost {
  const compartments = new Map<string, Compartment>();
  const compartmentFor = (key: string): Compartment => {
    let c = compartments.get(key);
    if (!c) {
      c = new Compartment();
      compartments.set(key, c);
    }
    return c;
  };
  runSetups(registry, ctx);
  watchSlots(registry, ctx, compartmentFor);
  watchFeatures(registry, ctx);
  return {
    extensions: () => registry.extensions(ctx, compartmentFor),
    run: (name, ...args) => registry.command(name)(ctx, ...args),
    mount: (view) => registry.features.forEach((f) => f.onMount?.(ctx, view)),
    beforeSwitchTab: (view, ids) => registry.features.forEach((f) => f.beforeTabSwitch?.(ctx, view, ids)),
    switchTab: (view, ids) => registry.features.forEach((f) => f.onTabSwitch?.(ctx, view, ids)),
    reconfigure: (slotKey, ext) => {
      const view = ctx.view();
      if (view) view.dispatch({ effects: compartmentFor(slotKey).reconfigure(ext) });
    },
    unmount: (view) => registry.features.forEach((f) => f.onUnmount?.(ctx, view)),
  };
}
