import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { completionStatus } from '@codemirror/autocomplete';
import { fakeContext, stateWith } from '../editor/internal/cm-probe.ts';
import { en } from '../../i18n/en.ts';
import type { EditorFeature } from '../editor/contracts/index.ts';

import { createCompletionFeature } from './contracts/completion.feature.ts';

const feature: EditorFeature = createCompletionFeature();

test('manifest: id and settingsKeys exist in defaults()', () => {
  assert.equal(feature.id, 'completion');
  const source = readFileSync(new URL('../../stores/settings.ts', import.meta.url), 'utf8');
  const body = source.slice(source.indexOf('export function defaults'));
  for (const key of feature.settingsKeys) assert.match(body, new RegExp(`^\\s+${key}:`, 'm'), key);
});

test('manifest: i18nKeys resolve in en.ts', () => {
  for (const key of feature.i18nKeys) {
    const path = key.replace(/\.\*$/, '').split('.');
    const value = path.reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], en);
    assert.ok(value !== undefined, key);
    if (key.endsWith('.*')) assert.equal(typeof value, 'object', key);
  }
});

test('md-completion is empty for non-markdown tabs', () => {
  const ctx = fakeContext({ tabValue: { language: 'ts' } });
  assert.deepEqual(feature.extensions?.['md-completion']?.(ctx), []);
});

test('md-completion builds a state for markdown with no active completion', () => {
  const ctx = fakeContext({ tabValue: { language: 'markdown' } });
  const ext = feature.extensions?.['md-completion']?.(ctx);
  assert.ok(Array.isArray(ext) && ext.length === 6);
  assert.equal(completionStatus(stateWith(ext)), null);
});

test('slash slot: when only for markdown, deps follows the setting', () => {
  const slot = feature.slots?.find((s) => s.slot === 'slash');
  assert.ok(slot);
  assert.equal(slot.when?.(fakeContext({ tabValue: { language: 'markdown' } })), true);
  assert.equal(slot.when?.(fakeContext({ tabValue: { language: 'ts' } })), false);
  assert.equal(slot.deps(fakeContext({ settings: { slashCommandsEnabled: false } })), false);
  assert.deepEqual(slot.build(fakeContext({ settings: { slashCommandsEnabled: false } })), []);
});

test('md-completion reads citations lazily, never at build time', () => {
  let reads = 0;
  const ctx = fakeContext({ tabValue: { language: 'markdown' }, citations: () => { reads += 1; return []; } });
  stateWith(feature.extensions?.['md-completion']?.(ctx) ?? []);
  assert.equal(reads, 0);
});
