import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveInsertTargetId } from './mindmap-insert.ts';

test('selected mode uses selection', () => assert.equal(resolveInsertTargetId('n1', 'root', 'selected'), 'n1'));
test('selected mode without selection falls back to root', () => assert.equal(resolveInsertTargetId(null, 'root', 'selected'), 'root'));
test('root mode ignores selection', () => assert.equal(resolveInsertTargetId('n1', 'root', 'root'), 'root'));
