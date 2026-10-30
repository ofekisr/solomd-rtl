import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { createValidation, resolveValidationMode } from './validation.service.ts';

const schema = z.object({ path: z.string() });

test('off never reports or throws', () => {
  const seen: string[] = [];
  createValidation('off', (m) => seen.push(m)).check('read_file', 'args', schema, { path: 1 });
  assert.deepEqual(seen, []);
});

test('report logs drift with command, part and path', () => {
  const seen: string[] = [];
  createValidation('report', (m) => seen.push(m)).check('read_file', 'args', schema, { path: 1 });
  assert.equal(seen.length, 1);
  assert.match(seen[0], /^\[platform:drift\] read_file args: path /);
});

test('strict throws on drift', () => {
  assert.throws(() => createValidation('strict').check('read_file', 'result', z.string(), 3), /\[platform:drift\] read_file result/);
});

test('missing schema is skipped in every mode', () => {
  createValidation('strict').check('x', 'args', undefined, { anything: true });
});

test('valid values pass silently', () => {
  const seen: string[] = [];
  createValidation('report', (m) => seen.push(m)).check('read_file', 'args', schema, { path: '/a' });
  assert.deepEqual(seen, []);
});

test('report logs each distinct message once per instance', () => {
  const seen: string[] = [];
  const validation = createValidation('report', (m) => seen.push(m));
  validation.check('read_file', 'args', schema, { path: 1 });
  validation.check('read_file', 'args', schema, { path: 2 });
  validation.check('read_file', 'args', schema, {});
  assert.equal(seen.length, 2);
});

test('resolveValidationMode is strict in dev and off otherwise', () => {
  assert.equal(resolveValidationMode({ DEV: true }), 'strict');
  assert.equal(resolveValidationMode({ DEV: false }), 'off');
  assert.equal(resolveValidationMode({}), 'off');
  assert.equal(resolveValidationMode(undefined), 'off');
});
