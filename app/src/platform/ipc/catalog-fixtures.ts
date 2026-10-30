import type { CommandCatalog } from './command.port.ts';
import { driftMessage } from './validation.service.ts';

export interface CommandFixture {
  readonly args?: unknown;
  readonly result: unknown;
}

export type CatalogFixtures = Readonly<Record<string, CommandFixture>>;

export function catalogFixtureProblems(catalog: CommandCatalog, fixtures: CatalogFixtures): string[] {
  const missing = Object.keys(catalog).filter((command) => !(command in fixtures)).map((command) => `${command}: no fixture`);
  const unknown = Object.keys(fixtures).filter((command) => !(command in catalog)).map((command) => `${command}: fixture for unknown command`);
  const failing = Object.entries(fixtures).filter(([command]) => command in catalog).flatMap(([command, fixture]) => fixtureFailures(catalog, command, fixture));
  return [...missing, ...unknown, ...failing];
}

function fixtureFailures(catalog: CommandCatalog, command: string, fixture: CommandFixture): string[] {
  const spec = catalog[command];
  const failures: string[] = [];
  if (spec.args) {
    const parsed = spec.args.safeParse(fixture.args);
    if (!parsed.success) failures.push(stripPrefix(driftMessage(command, 'args', parsed.error)));
  }
  const result = spec.result.safeParse(fixture.result);
  if (!result.success) failures.push(stripPrefix(driftMessage(command, 'result', result.error)));
  return failures;
}

const DRIFT_PREFIX = '[platform:drift] ';

function stripPrefix(message: string): string {
  return message.slice(DRIFT_PREFIX.length);
}
