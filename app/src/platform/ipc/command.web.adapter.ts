import { PlatformUnsupportedError, snakeToCamel, type CommandCatalog, type CommandPort } from './command.port.ts';

export function createWebPort<C extends CommandCatalog>(catalog: C, overrides: Partial<CommandPort<C>> = {}): CommandPort<C> {
  const port: Record<string, () => Promise<never>> = {};
  for (const command of Object.keys(catalog)) {
    port[snakeToCamel(command)] = () => Promise.reject(new PlatformUnsupportedError(command));
  }
  return { ...port, ...overrides } as unknown as CommandPort<C>;
}
