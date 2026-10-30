import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Compartment, type Extension } from '@codemirror/state';
import { createEditorFeatureRegistry } from './editor-feature-registry.service.ts';
import { fakeContext } from '../contracts/testkit.ts';
import type { EditorFeature } from '../contracts/editor-feature.port.ts';

const tag = (name: string): Extension => ({ name } as unknown as Extension);
const comps = () => { const m = new Map<string, Compartment>(); return (k: string) => m.get(k) ?? (m.set(k, new Compartment()), m.get(k)!); };
const feature = (id: string, extra: Partial<EditorFeature> = {}): EditorFeature => ({ id, settingsKeys: [], i18nKeys: [], ...extra });

test('extensions sort by slot rank, ties by registration order', () => {
  const a = feature('a', { extensions: { keymap: () => tag('a-keymap'), history: () => tag('a-history') } });
  const b = feature('b', { extensions: { 'ime-guard': () => tag('b-ime'), keymap: () => tag('b-keymap') } });
  const names = createEditorFeatureRegistry([a, b]).extensions(fakeContext(), comps()).map((e) => (e as { name: string }).name);
  assert.deepEqual(names, ['b-ime', 'a-history', 'a-keymap', 'b-keymap']);
});
test('a slot whose when() is false contributes nothing', () => {
  const f = feature('f', { slots: [{ slot: 'vim', deps: () => 1, build: () => tag('vim'), when: () => false }] });
  assert.equal(createEditorFeatureRegistry([f]).extensions(fakeContext(), comps()).length, 0);
});
test('slot keys are featureId:slot', () => {
  const f = feature('vim', { slots: [{ slot: 'vim', deps: () => 1, build: () => [] }] });
  assert.deepEqual(createEditorFeatureRegistry([f]).slots.map((s) => s.key), ['vim:vim']);
});
test('duplicate id, duplicate command, bad id, repeated slot throw', () => {
  assert.throws(() => createEditorFeatureRegistry([feature('a'), feature('a')]), /duplicate feature id: a/);
  const cmd = { commands: { go: () => 1 } };
  assert.throws(() => createEditorFeatureRegistry([feature('a', cmd), feature('b', cmd)]), /duplicate command: go/);
  assert.throws(() => createEditorFeatureRegistry([feature('Bad')]));
  const twice = feature('t', { slots: [{ slot: 'fold', deps: () => 1, build: () => [] }, { slot: 'fold', deps: () => 2, build: () => [] }] });
  assert.throws(() => createEditorFeatureRegistry([twice]), /uses slot fold twice/);
});
test('command() returns the feature command and throws on unknown', () => {
  const r = createEditorFeatureRegistry([feature('a', { commands: { go: (_ctx: unknown, n: unknown) => Number(n) + 1 } })]);
  assert.equal(r.command('go')(fakeContext(), 1), 2);
  assert.throws(() => r.command('nope'), /unknown command: nope/);
});
