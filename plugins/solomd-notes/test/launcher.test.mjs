import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const LAUNCHER = fileURLToPath(new URL('../bin/solomd-mcp', import.meta.url));
const WORKSPACE = '/tmp/notes';
const BASE_ENV = { PATH: '/usr/bin:/bin', HOME: mkdtempSync(join(tmpdir(), 'notes-home-')) };
const APP_INSTALLED = existsSync('/Applications/SoloMD.app');

function fakeBinary() {
  const path = join(mkdtempSync(join(tmpdir(), 'notes-bin-')), 'solomd-mcp');
  writeFileSync(path, '#!/bin/sh\necho "$@"\n');
  chmodSync(path, 0o755);
  return path;
}

const run = (env) => spawnSync(LAUNCHER, [], { env: { ...BASE_ENV, ...env }, encoding: 'utf8' });

test('passes the workspace and stays read-only by default', () => {
  const r = run({ SOLOMD_MCP_BIN: fakeBinary(), SOLOMD_WORKSPACE: WORKSPACE });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trim(), `--workspace ${WORKSPACE}`);
});

test('adds --allow-write only when SOLOMD_ALLOW_WRITE=1', () => {
  const r = run({ SOLOMD_MCP_BIN: fakeBinary(), SOLOMD_WORKSPACE: WORKSPACE, SOLOMD_ALLOW_WRITE: '1' });
  assert.equal(r.stdout.trim(), `--workspace ${WORKSPACE} --allow-write`);
});

test('fails with a hint when SOLOMD_WORKSPACE is unset', () => {
  const r = run({ SOLOMD_MCP_BIN: fakeBinary() });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /set SOLOMD_WORKSPACE to your notes folder/);
});

test('fails with a hint when no binary is found', { skip: APP_INSTALLED && 'SoloMD.app is installed here' }, () => {
  const r = run({ SOLOMD_WORKSPACE: WORKSPACE });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /solomd-mcp not found: install SoloMD.app or set SOLOMD_MCP_BIN/);
});
