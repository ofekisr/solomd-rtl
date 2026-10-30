import { snakeToCamel } from './command-name.ts';
import type { CommandCatalog, CommandPort, CommandSpec, InvokeFn } from './command.port.ts';
import type { Validation } from './validation.service.ts';

type RawMethod = (args?: Record<string, unknown>) => Promise<unknown>;

export function createTauriPort<C extends CommandCatalog>(catalog: C, invoke: InvokeFn, validation: Validation): CommandPort<C> {
  const port: Record<string, RawMethod> = {};
  for (const [command, spec] of Object.entries(catalog)) {
    port[snakeToCamel(command)] = (args) => callCommand(command, spec, args, invoke, validation);
  }
  return port as unknown as CommandPort<C>;
}

async function callCommand(
  command: string,
  spec: CommandSpec,
  args: Record<string, unknown> | undefined,
  invoke: InvokeFn,
  validation: Validation,
): Promise<unknown> {
  validation.check(command, 'args', spec.args, args);
  const raw = args === undefined ? await invoke(command) : await invoke(command, args);
  validation.check(command, 'result', spec.result, raw);
  return raw;
}
