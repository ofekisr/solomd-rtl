import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EditorFeatureManifestSchema } from '../../contracts/editor-feature.port.ts';
import { createAppearanceFeature } from './appearance.feature.ts';
import { createCoreFeature } from './core.feature.ts';
import { createLiveRenderFeature } from './live-render.feature.ts';


for (const feature of [createCoreFeature(), createAppearanceFeature(), createLiveRenderFeature()]) {
  test(`${feature.id}: manifest is valid`, () => {
    assert.doesNotThrow(() => EditorFeatureManifestSchema.parse(feature));
  });
}
