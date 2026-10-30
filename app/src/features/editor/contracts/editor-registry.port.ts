import type { InjectionKey } from 'vue';
import type { EditorFeatureRegistry } from '../internal/editor-feature-registry.service.ts';

export const EDITOR_REGISTRY_FACTORY: InjectionKey<() => EditorFeatureRegistry> = Symbol('editor-registry-factory');
