import {
  SETTINGS_VERSION,
  SETTINGS_VERSION_KEY,
  type DriftReporter,
  type SettingsMigration,
  type SettingsMigrationEnv,
  type SettingsRecord,
  type SettingsSlice,
} from '../contracts/index.ts';

const LEGACY_VERSION = 1;

export interface LoadSettingsOptions {
  report?: DriftReporter;
  isMobile?: boolean;
}

export interface LoadedSettings {
  settings: SettingsRecord;
  hadStored: boolean;
}

type AnySlice = SettingsSlice<SettingsRecord>;

function isPlainObject(value: unknown): value is SettingsRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function mergeDefaults(slices: readonly AnySlice[]): SettingsRecord {
  return Object.assign({}, ...slices.map((slice) => slice.defaults()));
}

function withVersion(settings: SettingsRecord): SettingsRecord {
  return { ...settings, [SETTINGS_VERSION_KEY]: SETTINGS_VERSION };
}

function storedVersion(raw: SettingsRecord): number {
  const version = raw[SETTINGS_VERSION_KEY];
  return typeof version === 'number' && Number.isFinite(version) ? version : LEGACY_VERSION;
}

function applyMigrations(raw: SettingsRecord, migrations: readonly SettingsMigration[], env: SettingsMigrationEnv): SettingsRecord {
  const fromVersion = storedVersion(raw);
  return [...migrations]
    .filter((migration) => migration.to > fromVersion)
    .sort((a, b) => a.to - b.to)
    .reduce((current, migration) => migration.up({ ...current }, env), raw);
}

function reportDrift(settings: SettingsRecord, slices: readonly AnySlice[], report: DriftReporter): void {
  for (const slice of slices) {
    const picked = Object.fromEntries(Object.keys(slice.schema.shape).map((key) => [key, settings[key]]));
    const result = slice.schema.safeParse(picked);
    if (result.success) continue;
    const firstIssueByKey = new Map<string, string>();
    for (const issue of result.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (!firstIssueByKey.has(key)) firstIssueByKey.set(key, issue.message);
    }
    for (const [key, message] of firstIssueByKey) report(`[settings:drift] ${slice.id}.${key}: ${message}`);
  }
}

function buildSettings(parsed: SettingsRecord, slices: readonly AnySlice[], migrations: readonly SettingsMigration[], env: SettingsMigrationEnv): SettingsRecord {
  const migrated = applyMigrations(parsed, migrations, env);
  const merged: SettingsRecord = { ...mergeDefaults(slices), ...migrated };
  for (const slice of slices) slice.normalize?.(migrated, merged);
  return withVersion(merged);
}

function parseRaw(raw: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(raw) as unknown };
  } catch {
    return { ok: false };
  }
}

export function loadSettings(
  raw: string | null,
  slices: readonly AnySlice[],
  migrations: readonly SettingsMigration[],
  opts: LoadSettingsOptions = {},
): LoadedSettings {
  const defaults = withVersion(mergeDefaults(slices));
  if (!raw) return { settings: defaults, hadStored: false };
  const parsed = parseRaw(raw);
  if (!parsed.ok) return { settings: defaults, hadStored: false };
  if (!isPlainObject(parsed.value)) return { settings: defaults, hadStored: true };
  try {
    const settings = buildSettings(parsed.value, slices, migrations, { isMobile: opts.isMobile ?? false });
    if (opts.report) reportDrift(settings, slices, opts.report);
    return { settings, hadStored: true };
  } catch (error) {
    opts.report?.(`[settings:load-failed] ${error instanceof Error ? error.message : String(error)}`);
    return { settings: defaults, hadStored: true };
  }
}
