import { register } from 'node:module';
register(new URL('./relationships.selftest-loader.mjs', import.meta.url));
await import('./markdown-block-badges.test.ts');
