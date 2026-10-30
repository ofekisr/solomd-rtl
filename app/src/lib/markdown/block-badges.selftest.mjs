import { register } from 'node:module';
register(new URL('../relationships.selftest-loader.mjs', import.meta.url));
await import('./block-badges.test.ts');
