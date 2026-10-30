import type { z } from 'zod';
import type { SnakeToCamel } from './command-name.ts';

export interface CommandSpec {
  readonly args?: z.ZodType;
  readonly result: z.ZodType;
}

export type CommandCatalog = Readonly<Record<string, CommandSpec>>;

type CommandMethod<S extends CommandSpec> = S extends { readonly args: infer A extends z.ZodType }
  ? (args: z.input<A>) => Promise<z.output<S['result']>>
  : () => Promise<z.output<S['result']>>;

export type CommandPort<C extends CommandCatalog> = {
  readonly [K in keyof C & string as SnakeToCamel<K>]: CommandMethod<C[K]>;
};

export type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;
