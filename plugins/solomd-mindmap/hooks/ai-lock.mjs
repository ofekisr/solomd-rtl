#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AI_LOCK_SUFFIX = '.ai-lock';
const LOCK_MODE = 0o600;
const MARK_EVENTS = new Set(['PreToolUse', 'PostToolUse']);
const RELEASE_EVENTS = new Set(['Stop', 'SessionEnd']);
const REGISTRY_DIR = process.env.SOLOMD_AI_LOCK_REGISTRY ?? join(homedir(), '.cache', 'solomd-ai-lock');
const PRIVATE_DIR_MODE = 0o700;
const GROUP_OTHER_BITS = 0o077;
const ABANDONED_AFTER_MS = 10 * 60_000;

export function markerPath(file, sessionId) {
  return join(dirname(file), `.${basename(file)}${AI_LOCK_SUFFIX}-${sessionId}`);
}

function registryDir(sessionId) {
  return join(REGISTRY_DIR, sessionId);
}

function registeredMarkers(sessionId) {
  const dir = registryDir(sessionId);
  try {
    if (!isPrivateDir(dir)) return [];
    return readdirSync(dir).map((entry) => readFileSync(join(dir, entry), 'utf8'));
  } catch {
    return [];
  }
}

function isPrivateDir(dir) {
  const st = lstatSync(dir);
  return st.isDirectory() && st.uid === process.getuid() && (st.mode & GROUP_OTHER_BITS) === 0;
}

function register(marker, sessionId) {
  const dir = registryDir(sessionId);
  mkdirSync(dir, { recursive: true, mode: PRIVATE_DIR_MODE });
  if (!isPrivateDir(REGISTRY_DIR) || !isPrivateDir(dir)) return;
  const entry = join(dir, createHash('sha1').update(marker).digest('hex'));
  try { unlinkSync(entry); } catch { /* not there yet */ }
  writeFileSync(entry, marker, { flag: 'wx', mode: LOCK_MODE });
}

function isOwnMarker(marker, sessionId) {
  if (!marker.startsWith('/') || !basename(marker).endsWith(`${AI_LOCK_SUFFIX}-${sessionId}`)) return false;
  try { return lstatSync(marker).uid === process.getuid(); } catch { return false; }
}

function writeMarker(marker) {
  try { unlinkSync(marker); } catch { /* not there yet */ }
  try {
    writeFileSync(marker, JSON.stringify({ at: new Date().toISOString() }), { flag: 'wx', mode: LOCK_MODE });
    return true;
  } catch {
    return false;
  }
}

export function mark(file, sessionId) {
  const marker = markerPath(file, sessionId);
  register(marker, sessionId);
  writeMarker(marker);
}

export function release(sessionId) {
  for (const marker of registeredMarkers(sessionId)) {
    if (isOwnMarker(marker, sessionId)) rmSync(marker, { force: true });
  }
  rmSync(registryDir(sessionId), { recursive: true, force: true });
}

function isAbandoned(dir) {
  try { return Date.now() - statSync(dir).mtimeMs > ABANDONED_AFTER_MS; } catch { return false; }
}

export function sweepAbandoned(currentSessionId) {
  let sessions;
  try { sessions = readdirSync(REGISTRY_DIR); } catch { return; }
  for (const sessionId of sessions) {
    if (sessionId === currentSessionId || !UUID.test(sessionId)) continue;
    if (isAbandoned(registryDir(sessionId))) release(sessionId);
  }
}

function targetFile(input) {
  const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  return typeof file === 'string' && file.startsWith('/') ? file : null;
}

export function handle(input) {
  const sessionId = input.session_id;
  if (typeof sessionId !== 'string' || !UUID.test(sessionId)) return;
  if (input.hook_event_name === 'SessionStart') return sweepAbandoned(sessionId);
  if (RELEASE_EVENTS.has(input.hook_event_name)) return release(sessionId);
  if (!MARK_EVENTS.has(input.hook_event_name)) return;
  const file = targetFile(input);
  if (file) mark(file, sessionId);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let raw = '';
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    try { handle(JSON.parse(raw)); } catch { /* never block the agent */ }
  });
}
