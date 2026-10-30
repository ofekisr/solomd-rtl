import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { SETTINGS_VERSION, SettingsSliceManifestSchema, type SettingsMigration, type SettingsSlice } from '../contracts/index.ts';
import { loadSettings } from './settings-load.service.ts';

function counterSlice(calls: string[]): SettingsSlice<{ count: number }> {
  return {
    id: 'counter',
    schema: z.object({ count: z.number() }),
    defaults: () => ({ count: 1 }),
    normalize: (_parsed, merged) => {
      calls.push('counter');
      if (typeof merged.count === 'number' && merged.count > 10) merged.count = 10;
    },
  };
}

function labelSlice(calls: string[]): SettingsSlice<{ label: string }> {
  return {
    id: 'label',
    schema: z.object({ label: z.string() }),
    defaults: () => ({ label: 'x' }),
    normalize: () => void calls.push('label'),
  };
}

const bump: SettingsMigration = { to: 2, up: (raw) => ({ ...raw, bumped: true }) };

function load(raw: string | null, calls: string[] = [], migrations: readonly SettingsMigration[] = [bump], report?: (m: string) => void) {
  return loadSettings(raw, [counterSlice(calls), labelSlice(calls)], migrations, { report });
}

test('no raw returns merged defaults at the current version, hadStored false', () => {
  const { settings, hadStored } = load(null);
  assert.deepEqual(settings, { count: 1, label: 'x', settingsVersion: SETTINGS_VERSION });
  assert.equal(hadStored, false);
});

test('bad JSON returns defaults, hadStored false', () => {
  const { settings, hadStored } = load('{nope');
  assert.deepEqual(settings, { count: 1, label: 'x', settingsVersion: SETTINGS_VERSION });
  assert.equal(hadStored, false);
});

test('valid JSON that is not an object returns defaults, hadStored true', () => {
  assert.equal(load('null').hadStored, true);
  assert.equal(load('[1]').settings.count, 1);
});

test('stored values win over defaults and unknown keys pass through', () => {
  const { settings, hadStored } = load('{"count":3,"futureFlag":true}');
  assert.equal(settings.count, 3);
  assert.equal(settings.futureFlag, true);
  assert.equal(hadStored, true);
});

test('settingsVersion is written as 2', () => {
  assert.equal(load('{}').settings.settingsVersion, SETTINGS_VERSION);
  assert.equal(load('{"settingsVersion":1}').settings.settingsVersion, SETTINGS_VERSION);
});

test('a blob without settingsVersion runs the step; a v2 blob runs none', () => {
  assert.equal(load('{}').settings.bumped, true);
  assert.equal(load('{"settingsVersion":2}').settings.bumped, undefined);
});

test('migrations run in ascending order of target version', () => {
  const trail: string[] = [];
  const mk = (to: number): SettingsMigration => ({ to, up: (raw) => (trail.push(`to${to}`), raw) });
  load('{}', [], [mk(4), mk(3), mk(2)]);
  assert.deepEqual(trail, ['to2', 'to3', 'to4']);
});

test('slice normalize runs in registration order and clamps', () => {
  const calls: string[] = [];
  const { settings } = load('{"count":99}', calls);
  assert.deepEqual(calls, ['counter', 'label']);
  assert.equal(settings.count, 10);
});

test('drift is reported once per key and the value is kept', () => {
  const reports: string[] = [];
  const { settings } = load('{"label":42}', [], [bump], (message) => reports.push(message));
  assert.equal(reports.length, 1);
  assert.match(reports[0], /^\[settings:drift\] label\.label: /);
  assert.equal(settings.label, 42);
});

test('no drift, no report', () => {
  const reports: string[] = [];
  load('{"count":2}', [], [bump], (message) => reports.push(message));
  assert.deepEqual(reports, []);
});

test('a throwing normalize falls back to defaults with hadStored true', () => {
  const boom: SettingsSlice<{ n: number }> = { id: 'boom', schema: z.object({ n: z.number() }), defaults: () => ({ n: 0 }), normalize: () => { throw new Error('x'); } };
  const result = loadSettings('{"n":5}', [boom], []);
  assert.equal(result.settings.n, 0);
  assert.equal(result.hadStored, true);
});

test('slice manifest ids must be kebab-case', () => {
  assert.equal(SettingsSliceManifestSchema.safeParse({ id: 'editor-core', keys: ['a'] }).success, true);
  assert.equal(SettingsSliceManifestSchema.safeParse({ id: 'EditorCore', keys: ['a'] }).success, false);
  assert.equal(SettingsSliceManifestSchema.safeParse({ id: 'a_b', keys: ['a'] }).success, false);
});

test('normalize receives the pre-migration parsed object', () => {
  let seen: Readonly<Record<string, unknown>> = {};
  const spy: SettingsSlice<{ count: number }> = { id: 'spy', schema: z.object({ count: z.number() }), defaults: () => ({ count: 1 }), normalize: (parsed) => { seen = parsed; } };
  loadSettings('{"count":2}', [spy], [bump]);
  assert.deepEqual(seen, { count: 2 });
});

test('a load failure is reported once', () => {
  const boom: SettingsSlice<{ n: number }> = { id: 'boom', schema: z.object({ n: z.number() }), defaults: () => ({ n: 0 }), normalize: () => { throw new Error('kaput'); } };
  const reports: string[] = [];
  loadSettings('{}', [boom], [], { report: (message) => reports.push(message) });
  assert.deepEqual(reports, ['[settings:load-failed] kaput']);
});
