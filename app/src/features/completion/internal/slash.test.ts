import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeContext } from '../../editor/internal/cm-probe.ts';
import { slashExt, slashOptions } from './slash.ts';

test('slashExt is empty when slash commands are disabled', () => {
  const ctx = fakeContext({ settings: { slashCommandsEnabled: false } });
  assert.deepEqual(slashExt(ctx), []);
});

test('slashExt builds extensions when enabled', () => {
  const ctx = fakeContext({ settings: { slashCommandsEnabled: true } });
  const ext = slashExt(ctx);
  assert.ok(Array.isArray(ext) && ext.length > 0);
});

test('labelFor/hintFor are undefined when t echoes the key back', () => {
  const opts = slashOptions(fakeContext({ settings: { slashCommandsEnabled: true } }));
  assert.equal(opts.labelFor?.('h1'), undefined);
  assert.equal(opts.hintFor?.('h1'), undefined);
});

test('labelFor/hintFor return the translation otherwise', () => {
  const ctx = fakeContext({
    settings: { slashCommandsEnabled: true },
    t: (key) => (key === 'slashCommands.labels.h1' ? 'Heading 1' : key === 'slashCommands.hints.h1' ? 'Big' : key),
  });
  const opts = slashOptions(ctx);
  assert.equal(opts.labelFor?.('h1'), 'Heading 1');
  assert.equal(opts.hintFor?.('h1'), 'Big');
  assert.equal(opts.labelFor?.('h2'), undefined);
});

test('enabled() reads the live setting and emptyHint passes the query', () => {
  const settings = { slashCommandsEnabled: true };
  const ctx = fakeContext({ settings, t: (key, params) => `${key}|${params?.query}` });
  const opts = slashOptions(ctx);
  assert.equal(opts.enabled(), true);
  settings.slashCommandsEnabled = false;
  assert.equal(opts.enabled(), false);
  assert.equal(opts.emptyHint?.('zz'), 'slashCommands.empty|zz');
});
