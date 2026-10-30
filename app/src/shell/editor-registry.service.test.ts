import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Compartment, type EditorState } from '@codemirror/state';
import { EXTENSION_SLOTS } from '../features/editor/contracts/index.ts';
import { fakeContext } from '../features/editor/internal/cm-probe.ts';
import { stateWith } from '../features/editor/internal/cm-probe.ts';
import { defaults } from '../stores/settings.ts';
import { createEditorRegistry } from './editor-registry.service.ts';

function compartmentsFor(): (key: string) => Compartment {
  const map = new Map<string, Compartment>();
  return (key) => {
    let c = map.get(key);
    if (!c) { c = new Compartment(); map.set(key, c); }
    return c;
  };
}

function buildState(language: string, fileName: string): EditorState {
  const registry = createEditorRegistry();
  const ctx = fakeContext({ settings: defaults() as unknown as Record<string, unknown>, tabValue: { language, fileName } as never });
  return stateWith(registry.extensions(ctx, compartmentsFor()), 'hello');
}

test('every slot except update-listener is used by a registered feature', () => {
  const registry = createEditorRegistry();
  const used = new Set<string>();
  for (const f of registry.features) {
    for (const k of Object.keys(f.extensions ?? {})) used.add(k);
    for (const s of f.slots ?? []) used.add(s.slot);
  }
  const unused = EXTENSION_SLOTS.filter((s) => s !== 'update-listener' && !used.has(s));
  assert.deepEqual(unused, []);
});

test('feature ids are unique', () => {
  const ids = createEditorRegistry().features.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('builds an EditorState for markdown and ts tabs', () => {
  assert.equal(buildState('markdown', 'a.md').doc.toString(), 'hello');
  assert.equal(buildState('ts', 'a.ts').doc.toString(), 'hello');
});
