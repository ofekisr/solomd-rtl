import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXTENSION_SLOTS, EditorFeatureManifestSchema } from './editor-feature.port.ts';

test('EXTENSION_SLOTS has 30 unique slots ending with update-listener', () => {
  assert.equal(EXTENSION_SLOTS.length, 30);
  assert.equal(new Set(EXTENSION_SLOTS).size, 30);
  assert.equal(EXTENSION_SLOTS.at(-1), 'update-listener');
});
test('manifest accepts kebab ids and rejects others', () => {
  assert.ok(EditorFeatureManifestSchema.safeParse({ id: 'image-upload', settingsKeys: [], i18nKeys: [] }).success);
  assert.ok(!EditorFeatureManifestSchema.safeParse({ id: 'ImageUpload', settingsKeys: [], i18nKeys: [] }).success);
});
