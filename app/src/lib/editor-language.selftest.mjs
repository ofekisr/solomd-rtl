import { register } from 'node:module';

register(new URL('./relationships.selftest-loader.mjs', import.meta.url));
await import('./editor-language.test.ts');
await import('./file-language.test.ts');
