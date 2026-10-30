import { z } from 'zod';

export const SETTINGS_STORAGE_KEY = 'solomd.settings.v1';
export const SETTINGS_VERSION = 2;
export const SETTINGS_VERSION_KEY = 'settingsVersion';

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export type SettingsRecord = Record<string, unknown>;

export interface SettingsSlice<S extends SettingsRecord = SettingsRecord> {
  id: string;
  schema: z.ZodObject<{ [K in keyof S]: z.ZodType<S[K]> }>;
  defaults(): S;
  /** `migrated` is the stored object AFTER migrations, before defaults; `merged` also has defaults applied. Must be idempotent: it runs on every load. */
  normalize?(migrated: Readonly<SettingsRecord>, merged: S & SettingsRecord): void;
}

export interface SettingsMigrationEnv {
  isMobile: boolean;
}

export interface SettingsMigration {
  to: number;
  up(raw: SettingsRecord, env: SettingsMigrationEnv): SettingsRecord;
}

export type DriftReporter = (message: string) => void;

export const SettingsSliceManifestSchema = z.object({
  id: z.string().regex(KEBAB_CASE_RE, 'slice id must be kebab-case'),
  keys: z.array(z.string().min(1)).min(1),
});

export type SettingsSliceManifest = z.infer<typeof SettingsSliceManifestSchema>;
