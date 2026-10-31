import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./session-id.mjs', import.meta.url));

test('prints the session id as SessionStart context', () => {
  const out = execFileSync('node', [script], { input: JSON.stringify({ session_id: '0f8fad5b-d9cb-469f-a165-70867728950e', hook_event_name: 'SessionStart' }) });
  const parsed = JSON.parse(out.toString());
  assert.equal(parsed.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.equal(parsed.hookSpecificOutput.additionalContext, 'claude-session-id: 0f8fad5b-d9cb-469f-a165-70867728950e');
});

test('prints nothing for bad input', () => {
  assert.equal(execFileSync('node', [script], { input: 'nope' }).toString(), '');
});
