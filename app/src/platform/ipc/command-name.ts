export type SnakeToCamel<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<SnakeToCamel<Tail>>}`
  : S;

const SNAKE_SEGMENT = /_([a-z0-9])/g;

export function snakeToCamel(name: string): string {
  return name.replace(SNAKE_SEGMENT, (_match, letter: string) => letter.toUpperCase());
}
