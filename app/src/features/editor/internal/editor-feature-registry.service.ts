import type { Extension } from '@codemirror/state';
import {
  EXTENSION_SLOTS,
  EditorFeatureManifestSchema,
  type CompartmentFor,
  type EditorCommand,
  type EditorFeature,
  type EditorFeatureContext,
  type FeatureWatch,
  type ReconfigurableSlot,
} from '../contracts/editor-feature.port.ts';

export interface RegisteredSlot { key: string; featureId: string; spec: ReconfigurableSlot }
export interface EditorFeatureRegistry {
  readonly features: readonly EditorFeature[];
  readonly slots: readonly RegisteredSlot[];
  readonly watches: readonly FeatureWatch[];
  extensions(ctx: EditorFeatureContext, compartmentFor: CompartmentFor): Extension[];
  command(name: string): EditorCommand;
  hasCommand(name: string): boolean;
}

interface Entry { rank: number; featureIndex: number; order: number; ext: Extension }

function validate(features: readonly EditorFeature[]): void {
  const ids = new Set<string>();
  for (const f of features) {
    EditorFeatureManifestSchema.parse({ id: f.id, settingsKeys: [...f.settingsKeys], i18nKeys: [...f.i18nKeys] });
    if (ids.has(f.id)) throw new Error(`[editor] duplicate feature id: ${f.id}`);
    ids.add(f.id);
    const used = new Set<string>();
    for (const s of f.slots ?? []) {
      if (used.has(s.slot)) throw new Error(`[editor] ${f.id} uses slot ${s.slot} twice`);
      used.add(s.slot);
    }
  }
}

function collectCommands(features: readonly EditorFeature[]): Map<string, EditorCommand> {
  const commands = new Map<string, EditorCommand>();
  for (const f of features) {
    for (const [name, fn] of Object.entries(f.commands ?? {})) {
      if (commands.has(name)) throw new Error(`[editor] duplicate command: ${name}`);
      commands.set(name, fn);
    }
  }
  return commands;
}

function collectSlots(features: readonly EditorFeature[]): RegisteredSlot[] {
  return features.flatMap((f) =>
    (f.slots ?? []).map((spec) => ({ key: `${f.id}:${spec.slot}`, featureId: f.id, spec })),
  );
}

function featureEntries(
  f: EditorFeature,
  featureIndex: number,
  ctx: EditorFeatureContext,
  compartmentFor: CompartmentFor,
): Entry[] {
  const entries: Entry[] = [];
  let order = 0;
  for (const slot of EXTENSION_SLOTS) {
    const build = f.extensions?.[slot];
    if (build) entries.push({ rank: EXTENSION_SLOTS.indexOf(slot), featureIndex, order: order++, ext: build(ctx) });
  }
  for (const spec of f.slots ?? []) {
    if (spec.when?.(ctx) === false) continue;
    const ext = compartmentFor(`${f.id}:${spec.slot}`).of(spec.build(ctx));
    entries.push({ rank: EXTENSION_SLOTS.indexOf(spec.slot), featureIndex, order: order++, ext });
  }
  return entries;
}

export function createEditorFeatureRegistry(features: readonly EditorFeature[]): EditorFeatureRegistry {
  validate(features);
  const commands = collectCommands(features);
  return {
    features,
    slots: collectSlots(features),
    watches: features.flatMap((f) => f.watches ?? []),
    extensions(ctx, compartmentFor) {
      return features
        .flatMap((f, i) => featureEntries(f, i, ctx, compartmentFor))
        .sort((a, b) => a.rank - b.rank || a.featureIndex - b.featureIndex || a.order - b.order)
        .map((e) => e.ext);
    },
    command(name) {
      const fn = commands.get(name);
      if (!fn) throw new Error(`[editor] unknown command: ${name}`);
      return fn;
    },
    hasCommand: (name) => commands.has(name),
  };
}
