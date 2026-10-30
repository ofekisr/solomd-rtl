import type { z } from 'zod';

export type ValidationMode = 'off' | 'report' | 'strict';
export type ValidationPart = 'args' | 'result';
export type DriftReporter = (message: string) => void;

export interface Validation {
  readonly mode: ValidationMode;
  check(operation: string, part: ValidationPart, schema: z.ZodType | undefined, value: unknown): void;
}

const ROOT_PATH = '(root)';

export function createValidation(mode: ValidationMode, report: DriftReporter = (message) => console.warn(message)): Validation {
  return {
    mode,
    check(operation, part, schema, value) {
      if (mode === 'off' || !schema) return;
      const parsed = schema.safeParse(value);
      if (parsed.success) return;
      const message = driftMessage(operation, part, parsed.error);
      if (mode === 'strict') throw new Error(message);
      report(message);
    },
  };
}

export function driftMessage(operation: string, part: ValidationPart, error: z.ZodError): string {
  const issue = error.issues[0];
  const path = issue && issue.path.length > 0 ? issue.path.join('.') : ROOT_PATH;
  return `[platform:drift] ${operation} ${part}: ${path} ${issue?.message ?? 'invalid'}`;
}
