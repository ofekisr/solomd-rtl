import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { markerPath } from './ai-lock.mjs';

const script = fileURLToPath(new URL('./ai-lock.mjs', import.meta.url));
const REGISTRY = mkdtempSync(join(tmpdir(), 'ai-lock-registry-'));
process.env.SOLOMD_AI_LOCK_REGISTRY = REGISTRY;
const SESSION = '0f8fad5b-d9cb-469f-a165-70867728950e';
const OTHER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

const run = (input) => execFileSync('node', [script], { input: JSON.stringify(input) });
const edit = (file, session = SESSION, event = 'PreToolUse') =>
  run({ session_id: session, hook_event_name: event, tool_name: 'Edit', tool_input: { file_path: file } });
const stop = (session = SESSION) => run({ session_id: session, hook_event_name: 'Stop' });
const workspace = () => mkdtempSync(join(tmpdir(), 'ai-lock-'));

test('marker is a hidden per-session sidecar', () => {
  assert.equal(markerPath('/w/a.md', SESSION), `/w/.a.md.ai-lock-${SESSION}`);
});

test('an edit marks the file and Stop releases it', () => {
  const file = join(workspace(), 'a.md');
  edit(file);
  assert.equal(existsSync(markerPath(file, SESSION)), true);
  stop();
  assert.equal(existsSync(markerPath(file, SESSION)), false);
});

test('Stop releases only its own session', () => {
  const file = join(workspace(), 'a.md');
  edit(file);
  edit(file, OTHER);
  stop();
  assert.equal(existsSync(markerPath(file, SESSION)), false);
  assert.equal(existsSync(markerPath(file, OTHER)), true);
  stop(OTHER);
});

test('a planted symlink is replaced, never written through', () => {
  const dir = workspace();
  const victim = join(dir, 'victim.txt');
  writeFileSync(victim, 'keep');
  const file = join(dir, 'a.md');
  symlinkSync(victim, markerPath(file, SESSION));
  edit(file);
  assert.equal(readFileSync(victim, 'utf8'), 'keep');
  stop();
});

test('ignores bad session ids and relative paths', () => {
  const dir = workspace();
  edit(join(dir, 'a.md'), '../../etc');
  edit('a.md');
  assert.equal(existsSync(markerPath(join(dir, 'a.md'), '../../etc')), false);
  assert.equal(run('nope' ).toString(), '');
});

test('SessionStart sweeps markers of sessions abandoned for 10 minutes', async () => {
  const { utimesSync } = await import('node:fs');
  const file = join(workspace(), 'a.md');
  edit(file, OTHER);
  const old = new Date(Date.now() - 11 * 60_000);
  utimesSync(join(REGISTRY, OTHER), old, old);
  run({ session_id: SESSION, hook_event_name: 'SessionStart' });
  assert.equal(existsSync(markerPath(file, OTHER)), false);
});
