#!/usr/bin/env node
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let raw = '';
process.stdin.on('data', (chunk) => { raw += chunk; });
process.stdin.on('end', () => {
  let id;
  try { id = JSON.parse(raw).session_id; } catch { return; }
  if (typeof id !== 'string' || !UUID.test(id)) return;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `claude-session-id: ${id}` } }));
});
