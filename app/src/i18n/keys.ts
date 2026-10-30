import type { en } from './en.ts';

type LeafPaths<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : `${K}.${LeafPaths<T[K]>}` }[keyof T & string];

type GroupPaths<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? never : K | `${K}.${GroupPaths<T[K]>}` }[keyof T & string];

export type I18nLeafKey = LeafPaths<typeof en>;
export type I18nGroupKey = `${GroupPaths<typeof en>}.*`;
export type I18nKey = I18nLeafKey | I18nGroupKey;
