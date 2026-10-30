import type { z } from 'zod';

export interface CommandSpec {
  readonly args?: z.ZodType;
  readonly result: z.ZodType;
}

export type CommandCatalog = Readonly<Record<string, CommandSpec>>;

export type SnakeToCamel<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
  : S;

type CommandMethod<S extends CommandSpec> = S extends { readonly args: infer A extends z.ZodType }
  ? (args: z.input<A>) => Promise<z.output<S['result']>>
  : () => Promise<z.output<S['result']>>;

export type CommandPort<C extends CommandCatalog> = {
  readonly [K in keyof C & string as SnakeToCamel<K>]: CommandMethod<C[K]>;
};

export type InvokeFn = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

const SNAKE_SEGMENT = /_([a-z0-9])/g;

export function snakeToCamel(name: string): string {
  return name.replace(SNAKE_SEGMENT, (_match, letter: string) => letter.toUpperCase());
}

export class PlatformUnsupportedError extends Error {
  readonly operation: string;

  constructor(operation: string) {
    super(`[platform] ${operation} is not supported on this platform`);
    this.name = 'PlatformUnsupportedError';
    this.operation = operation;
  }
}
