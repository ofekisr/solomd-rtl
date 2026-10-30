import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorFeatureManifestSchema } from '../../contracts/editor-feature.port.ts';
import { en } from '../../../../i18n/en.ts';
import { defaults } from '../../../../stores/settings.ts';
import { createAppearanceFeature } from './appearance.feature.ts';
import { createCoreFeature } from './core.feature.ts';
import { createLiveRenderFeature } from './live-render.feature.ts';


function resolveKey(key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], en);
}

for (const feature of [createCoreFeature(), createAppearanceFeature(), createLiveRenderFeature()]) {
  test(`${feature.id}: manifest is valid, settings keys exist, i18n keys resolve`, () => {
    assert.doesNotThrow(() => EditorFeatureManifestSchema.parse(feature));
    const settingKeys = Object.keys(defaults());
    for (const key of feature.settingsKeys) assert.ok(settingKeys.includes(key), `setting ${key}`);
    for (const key of feature.i18nKeys) assert.equal(typeof resolveKey(key), 'string', `i18n ${key}`);
  });
}
