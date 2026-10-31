# Plugins Folder + Marketplace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `plugin/`, `mcp-mindmap/`, `mcp-server/`, `dev-mcp/` into one `plugins/` folder, make the repo a Claude Code marketplace, and delete upstream listing material.

**Architecture:** Each plugin owns its skill, hooks and server source under `plugins/<name>/`. The mindmap server ships as a committed esbuild bundle so a marketplace install works without the repo. `solomd-notes` runs the `solomd-mcp` bundled in SoloMD.app through a launcher script. `solomd-dev` is wired by the repo's `.mcp.json` and is not listed.

**Tech Stack:** Node 22 (`node:test`, strip-types), esbuild (from `app/node_modules`), POSIX sh, Rust/Cargo, Claude Code plugin + marketplace manifests.

**Spec:** [docs/design/2026-10-31-plugins-marketplace-design.md](../design/2026-10-31-plugins-marketplace-design.md)

## Global Constraints

- Every commit passes `pnpm --dir app verify` (exit code is the only signal; never commit on red).
- Moves use `git mv` so history follows; no content edits in a move except path fixes.
- `app/arch/baseline.json` may not gain entries or raise values.
- Historical docs keep old paths: `docs/superpowers/{specs,plans}/**` (except this plan's spec), `CHANGELOG.md`, `web/**`.
- Plugin names: `solomd-mindmap`, `solomd-notes`, `solomd-dev`. Marketplace name: `solomd-rtl`.
- Env vars for the notes launcher: `SOLOMD_MCP_BIN`, `SOLOMD_WORKSPACE`, `SOLOMD_ALLOW_WRITE=1`.
- Error strings, verbatim: `solomd-mcp not found: install SoloMD.app or set SOLOMD_MCP_BIN` and `set SOLOMD_WORKSPACE to your notes folder`.
- Never edit `~/.claude/settings.json` without the user's explicit OK in chat (Task 8).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File map

| Path | Responsibility |
|---|---|
| `docs/design/adr/0008-plugins-folder.md` | Records spec decisions D1–D7 |
| `plugins/CLAUDE.md` | Agent guide: what each plugin is, build, test |
| `plugins/solomd-mindmap/` | Was `plugin/`; `server/` was `mcp-mindmap/` |
| `plugins/solomd-mindmap/server/build.mjs` | esbuild bundle + `--check` freshness gate |
| `plugins/solomd-mindmap/server/dist/index.mjs` | Generated bundle, committed |
| `plugins/solomd-mindmap/server/test/bundle.test.ts` | Bundle runs standalone and lists tools |
| `plugins/solomd-notes/server/` | Was `mcp-server/` (Rust crate) |
| `plugins/solomd-notes/bin/solomd-mcp` | Launcher: finds binary, checks env, execs |
| `plugins/solomd-notes/test/launcher.test.mjs` | Launcher behaviour |
| `plugins/solomd-notes/skills/solomd/SKILL.md` | Was `marketplace/claude-code-skill/solomd/SKILL.md` |
| `plugins/solomd-notes/docs/clients/*.md` | Was `marketplace/client-docs/*.md` |
| `plugins/solomd-dev/server/` | Was `dev-mcp/` (Rust crate) |
| `.claude-plugin/marketplace.json` | Lists `solomd-mindmap`, `solomd-notes` |
| `.mcp.json` | Project scope: `solomd-dev` |

---

### Task 1: ADR 0008

**Files:**
- Create: `docs/design/adr/0008-plugins-folder.md`
- Modify: `docs/design/adr/README.md` (index row)

- [ ] **Step 1: Read the ADR format**

Run: `cat docs/design/adr/0007-settings-registry-as-shipped.md docs/design/adr/README.md`
Match its headings (`Status`, `Context`, `Decision`, `Consequences`) and index-row style.

- [ ] **Step 2: Write the ADR**

```markdown
# 0008. One `plugins/` folder and a Claude Code marketplace

**Status**: accepted · **Date**: 2026-10-31

## Context

- Five root folders exposed SoloMD to agents with no visible relation: `mcp-server/`, `mcp-mindmap/`, `plugin/`, `dev-mcp/`, `marketplace/`.
- `plugin/` broke when installed from a marketplace: its `.mcp.json` and server imports reached outside the plugin folder.
- `marketplace/`, `server.json` and `smithery.yaml` advertised upstream; the fork publishes no releases.
- Full design: [spec](../2026-10-31-plugins-marketplace-design.md).

## Decision

1. All agent integrations live in `plugins/<name>/`; each plugin owns its skill, hooks and server source under `server/`.
2. `.claude-plugin/marketplace.json` at the root lists `solomd-mindmap` and `solomd-notes`.
3. `solomd-notes` runs the `solomd-mcp` bundled in SoloMD.app, falling back to `PATH`.
4. The mindmap server ships as a committed esbuild bundle; `verify` fails when it is stale.
5. `solomd-dev` is wired by the repo's `.mcp.json` and is not listed in the marketplace.
6. Upstream MCP-directory listings are deleted; the recipe copy is dropped in favour of `app/src-tauri/cookbook/`.

## Consequences

- Easier: one place for agent integrations; `/plugin marketplace add ofekisr/solomd-rtl` installs them.
- Harder: a generated file (`dist/index.mjs`) is committed and must be rebuilt after server changes.
- Must: run `pnpm --dir plugins/solomd-mindmap/server build` after editing the mindmap server or `app/src/lib/mindmap/`.
```

- [ ] **Step 3: Add the index row** to `docs/design/adr/README.md`, matching the existing rows: `| [0008](0008-plugins-folder.md) | One plugins/ folder and a Claude Code marketplace | accepted |` (adjust columns to the table's actual shape).

- [ ] **Step 4: Commit**

```bash
git add docs/design/adr/0008-plugins-folder.md docs/design/adr/README.md
git commit -m "docs(adr): 0008 one plugins/ folder and a marketplace

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Move `solomd-mindmap` (plugin + server), still running from source

**Files:**
- Move: `plugin/` → `plugins/solomd-mindmap/`; `mcp-mindmap/` → `plugins/solomd-mindmap/server/`
- Modify: `plugins/solomd-mindmap/.mcp.json`, `plugins/solomd-mindmap/server/{tsconfig.json,package.json}`, every `server/{src,test}/**/*.ts` that imports `app/src/lib`, `app/package.json` (`verify`), `app/arch/file-size.rule.ts`, `app/arch/file-size.rule.test.ts`, `app/arch/raw-ipc.rule.test.ts`, `app/arch/CLAUDE.md`, `plugins/solomd-mindmap/README.md`, root `CLAUDE.md`

**Interfaces:**
- Produces: server package at `plugins/solomd-mindmap/server` with scripts `test`, `typecheck`, `start`; later tasks add `build` and `check`.

- [ ] **Step 1: Baseline — hook tests run today?**

Run: `node --test plugin/hooks/*.test.mjs`
Expected: all pass. If any fail, stop and report — do not fix unrelated failures inside this task.

- [ ] **Step 2: Move**

```bash
mkdir -p plugins
git mv plugin plugins/solomd-mindmap
git mv mcp-mindmap plugins/solomd-mindmap/server
```

- [ ] **Step 3: Fix relative imports into `app/src`** (two folders deeper)

```bash
grep -rlE "(\.\./)+app/src/" plugins/solomd-mindmap/server/src plugins/solomd-mindmap/server/test \
  | xargs perl -pi -e "s{(['\"])((?:\.\./)+)app/src/}{\$1../../\$2app/src/}g"
grep -rnE "(\.\./)+app/src/" plugins/solomd-mindmap/server | head -3
```
Expected: `server/src/store.ts` now imports `'../../../../app/src/lib/mindmap/format.ts'`; `server/src/tools/*.ts` use five `../`.

- [ ] **Step 4: Fix `tsconfig.json` path**

In `plugins/solomd-mindmap/server/tsconfig.json` change
`"paths": { "mind-elixir": ["../app/node_modules/mind-elixir"] }` →
`"paths": { "mind-elixir": ["../../../app/node_modules/mind-elixir"] }`

- [ ] **Step 5: Run hook tests from the server package**

In `plugins/solomd-mindmap/server/package.json` change
`"test": "node --test --experimental-strip-types test/*.test.ts"` →
`"test": "node --test --experimental-strip-types test/*.test.ts ../hooks/*.test.mjs"`

- [ ] **Step 6: Point the plugin at the moved source**

`plugins/solomd-mindmap/.mcp.json`:

```json
{
  "mcpServers": {
    "solomd-mindmap": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server/src/index.ts", "--allow-write"]
    }
  }
}
```

- [ ] **Step 7: Update gates and arch rules**

- `app/package.json` `verify`: `pnpm --dir ../mcp-mindmap test` → `pnpm --dir ../plugins/solomd-mindmap/server test`
- `app/arch/file-size.rule.ts:15`: `root: 'mcp-mindmap/src'` → `root: 'plugins/solomd-mindmap/server/src'`
- `app/arch/file-size.rule.test.ts:15,22` and `app/arch/raw-ipc.rule.test.ts:13`: fixture key prefix `mcp-mindmap/src/` → `plugins/solomd-mindmap/server/src/`
- `app/arch/CLAUDE.md:9`: `` `mcp-mindmap/src` `` → `` `plugins/solomd-mindmap/server/src` ``

Then confirm the arch scanner still walks the new root:
Run: `grep -rn "mcp-mindmap" app/arch app/package.json`
Expected: no output.

- [ ] **Step 8: Update docs**

- `plugins/solomd-mindmap/README.md` Install block → `pnpm --dir app install`, `pnpm --dir plugins/solomd-mindmap/server install`, `claude --plugin-dir ./plugins/solomd-mindmap`; delete the sentence that says the plugin works only from a checkout because `.mcp.json` references `../mcp-mindmap`.
- Root `CLAUDE.md`: replace the `mcp-mindmap/` and `plugin/` Layout rows with one row: `` | `plugins/` | Claude Code plugins + their MCP servers — see [plugins/CLAUDE.md](plugins/CLAUDE.md) | ``; in the Greenness table change `mcp-mindmap tests` → `plugin tests`; in Layout's `mcp-mindmap` mention under Commands (if any) use the new path.
- Create `plugins/CLAUDE.md`:

```markdown
# plugins/

Claude Code plugins this repo exposes. Each plugin owns its skill, hooks and server source.

| Plugin | Server | Listed in marketplace |
|---|---|---|
| `solomd-mindmap/` | `server/` — TS, imports `app/src/lib/mindmap/` | Yes |

## Rules

- A plugin reads nothing outside its own folder at runtime: marketplace installs copy only the plugin folder.
- `server/src` `.ts` files ≤ 400 lines (`app/arch` file-size rule).

## Test

| Run | Covers |
|---|---|
| `pnpm --dir plugins/solomd-mindmap/server test` | server unit tests + hook tests |
```

- [ ] **Step 9: Reinstall and run the server tests**

```bash
pnpm --dir plugins/solomd-mindmap/server install
pnpm --dir plugins/solomd-mindmap/server test
pnpm --dir plugins/solomd-mindmap/server typecheck
```
Expected: 45 server tests + hook tests pass, `tsc` exits 0.

- [ ] **Step 10: Verify and commit**

Run: `pnpm --dir app verify` → exit 0.

```bash
git add -A plugins plugin mcp-mindmap app/package.json app/arch CLAUDE.md
git commit -m "refactor(plugins): move plugin/ + mcp-mindmap/ into plugins/solomd-mindmap

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Bundle the mindmap server

**Files:**
- Create: `plugins/solomd-mindmap/server/build.mjs`, `plugins/solomd-mindmap/server/test/bundle.test.ts`, `plugins/solomd-mindmap/server/dist/index.mjs` (generated)
- Modify: `plugins/solomd-mindmap/server/package.json`, `plugins/solomd-mindmap/.mcp.json`, `.gitignore`, `app/package.json` (`verify`), `plugins/solomd-mindmap/README.md`, `plugins/CLAUDE.md`

**Interfaces:**
- Consumes: server package from Task 2.
- Produces: `pnpm --dir plugins/solomd-mindmap/server build` writes `dist/index.mjs`; `… check` exits 1 when stale.

- [ ] **Step 1: Write the failing smoke test** — `server/test/bundle.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUNDLE = fileURLToPath(new URL('../dist/index.mjs', import.meta.url));
const TIMEOUT_MS = 10_000;
const LIST_ID = 2;

function listTools(server: string, workspace: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [server, '--workspace', workspace], { stdio: ['pipe', 'pipe', 'ignore'] });
    const timer = setTimeout(() => { child.kill(); reject(new Error('no tools/list reply')); }, TIMEOUT_MS);
    let buffer = '';
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const msg = JSON.parse(line);
        if (msg.id !== LIST_ID) continue;
        clearTimeout(timer);
        child.kill();
        resolve(msg.result.tools.map((t: { name: string }) => t.name));
      }
    });
    const send = (m: object): void => { child.stdin.write(`${JSON.stringify(m)}\n`); };
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'bundle-test', version: '0' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: LIST_ID, method: 'tools/list' });
  });
}

test('bundle runs outside the repo and lists the mmap tools', async () => {
  const isolated = mkdtempSync(join(tmpdir(), 'mmap-bundle-'));
  const server = join(isolated, 'index.mjs');
  copyFileSync(BUNDLE, server);
  const names = await listTools(server, mkdtempSync(join(tmpdir(), 'mmap-ws-')));
  assert.ok(names.includes('mmap_outline'));
  assert.ok(names.includes('mmap_add'));
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `cd plugins/solomd-mindmap/server && node --test --experimental-strip-types test/bundle.test.ts`
Expected: FAIL with `ENOENT … dist/index.mjs`.

- [ ] **Step 3: Write `server/build.mjs`**

```js
#!/usr/bin/env node
import { createRequire } from 'node:module';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'dist/index.mjs');
const EXECUTABLE = 0o755;
const HASHBANG = /^#!.*\n/m;
const { build } = createRequire(join(HERE, '../../../app/package.json'))('esbuild');

async function bundle() {
  const result = await build({
    entryPoints: [join(HERE, 'src/index.ts')],
    outfile: OUT,
    absWorkingDir: HERE,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
    legalComments: 'none',
    logLevel: 'warning',
    write: false,
  });
  const body = result.outputFiles[0].text.replace(HASHBANG, '');
  return `#!/usr/bin/env node\n${body}`;
}

function check(text) {
  if (existsSync(OUT) && readFileSync(OUT, 'utf8') === text) return;
  console.error('dist/index.mjs is stale: run pnpm --dir plugins/solomd-mindmap/server build');
  process.exit(1);
}

function write(text) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, text);
  chmodSync(OUT, EXECUTABLE);
}

const text = await bundle();
if (process.argv.includes('--check')) check(text);
else write(text);
```

- [ ] **Step 4: Add scripts** to `server/package.json` `scripts`:
`"build": "node build.mjs"`, `"check": "node build.mjs --check"`.

- [ ] **Step 5: Un-ignore the bundle** — root `.gitignore` has `**/dist/`. Append:

```
!plugins/solomd-mindmap/server/dist/
```

- [ ] **Step 6: Build and run the smoke test — expect PASS**

```bash
pnpm --dir plugins/solomd-mindmap/server build
head -1 plugins/solomd-mindmap/server/dist/index.mjs
cd plugins/solomd-mindmap/server && node --test --experimental-strip-types test/bundle.test.ts
```
Expected: first line is `#!/usr/bin/env node` (build.mjs strips esbuild's copy and prepends one); test PASS. If it fails with `Dynamic require of "…" is not supported`, the `createRequire` banner is missing — check line 2 of the bundle.

- [ ] **Step 7: Prove the freshness gate**

```bash
pnpm --dir plugins/solomd-mindmap/server check; echo "clean: $?"
echo "// stale" >> plugins/solomd-mindmap/server/src/config.ts
pnpm --dir plugins/solomd-mindmap/server check; echo "edited: $?"
git checkout plugins/solomd-mindmap/server/src/config.ts
```
Expected: `clean: 0`, then the stale message and `edited: 1`.

- [ ] **Step 8: Switch the plugin to the bundle** — `plugins/solomd-mindmap/.mcp.json` args:
`["${CLAUDE_PLUGIN_ROOT}/server/dist/index.mjs", "--allow-write"]`

- [ ] **Step 9: Gate it in `verify`** — `app/package.json`:
`pnpm --dir ../plugins/solomd-mindmap/server test` → `pnpm --dir ../plugins/solomd-mindmap/server test && pnpm --dir ../plugins/solomd-mindmap/server check`

- [ ] **Step 10: Docs**

- `plugins/solomd-mindmap/README.md` Install: marketplace install first (`/plugin marketplace add ofekisr/solomd-rtl` then `/plugin install solomd-mindmap@solomd-rtl`), Node ≥ 20 only; dev install via `--plugin-dir` stays. Add: "After editing `server/src` or `app/src/lib/mindmap/`, run `pnpm --dir plugins/solomd-mindmap/server build` — `verify` fails on a stale bundle."
- `plugins/CLAUDE.md`: add rows `build` and `check` to the Test table, and the rebuild rule under Rules.

- [ ] **Step 11: Verify and commit**

Run: `pnpm --dir app verify` → exit 0 (server tests now include `bundle.test.ts`).

```bash
git add .gitignore app/package.json plugins/solomd-mindmap plugins/CLAUDE.md
git commit -m "feat(plugins): ship solomd-mindmap server as a committed bundle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Move the `solomd-mcp` crate to `plugins/solomd-notes/server`

**Files:**
- Move: `mcp-server/` → `plugins/solomd-notes/server/`
- Modify: `.github/workflows/release.yml`, `scripts/{build-mcp-sidecar,build-mcpb,publish-mcp-crate,ubuntu-build,v4-self-test}.sh`, `app/src-tauri/src/{agent_tools,trace}.rs`, `app/src-tauri/src/commands/file_io.rs`, `app/src/lib/wikilinks.ts`, `docs/guides/agents.md`, `README*.md` (15 files)

- [ ] **Step 1: Move**

```bash
mkdir -p plugins/solomd-notes
git mv mcp-server plugins/solomd-notes/server
```

- [ ] **Step 2: Rewrite path references**

```bash
FILES=".github/workflows/release.yml scripts/build-mcp-sidecar.sh scripts/build-mcpb.sh scripts/publish-mcp-crate.sh scripts/ubuntu-build.sh scripts/v4-self-test.sh app/src-tauri/src/agent_tools.rs app/src-tauri/src/trace.rs app/src-tauri/src/commands/file_io.rs app/src/lib/wikilinks.ts docs/guides/agents.md README*.md"
perl -pi -e '
  s{(?<![\w/-])mcp-server/}{plugins/solomd-notes/server/}g;
  s{\$(REPO_ROOT|ROOT)/mcp-server\b}{\$$1/plugins/solomd-notes/server}g;
  s{/\.\./mcp-server"}{/../plugins/solomd-notes/server"}g;
  s{\(\s*cd mcp-server(?=\s|$)}{( cd plugins/solomd-notes/server}g;
  s{\(\./mcp-server\)}{(./plugins/solomd-notes/server)}g;
' $FILES
git grep -nE "(^|[^-/])mcp-server(/|\"|$)" -- $FILES
```
Expected: no output. `scripts/install-mcp.sh:172` keeps its upstream GitHub URL (`…/tree/main/mcp-server#wire-it-up`) on purpose — it points at upstream's tree.

- [ ] **Step 3: Check `build-mcpb.sh` relative paths by eye**

Run: `sed -n 45,110p scripts/build-mcpb.sh`
Expected: after `( cd plugins/solomd-notes/server …)` the later `plugins/solomd-notes/server/target/…` and `…/mcpb/manifest.json` paths are relative to the repo root (the `cd` was in a subshell). Fix any that are not.

- [ ] **Step 4: Build from the new path**

```bash
cargo check --manifest-path plugins/solomd-notes/server/Cargo.toml
cargo test --manifest-path plugins/solomd-notes/server/Cargo.toml
bash scripts/build-mcp-sidecar.sh
ls app/src-tauri/binaries/
```
Expected: check and tests pass; `binaries/` holds a fresh `solomd-mcp-<triple>`.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --dir app verify` → exit 0.

```bash
git add -A mcp-server plugins/solomd-notes .github scripts app/src-tauri/src app/src/lib/wikilinks.ts docs/guides/agents.md README*.md
git commit -m "refactor(plugins): move mcp-server/ into plugins/solomd-notes/server

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `solomd-notes` plugin — launcher, skill, docs

**Files:**
- Create: `plugins/solomd-notes/bin/solomd-mcp`, `plugins/solomd-notes/test/launcher.test.mjs`, `plugins/solomd-notes/.claude-plugin/plugin.json`, `plugins/solomd-notes/.mcp.json`, `plugins/solomd-notes/README.md`
- Move: `marketplace/claude-code-skill/solomd/SKILL.md` → `plugins/solomd-notes/skills/solomd/SKILL.md`; `marketplace/client-docs/*.md` → `plugins/solomd-notes/docs/clients/`
- Modify: `app/package.json` (`verify`), `plugins/CLAUDE.md`

**Interfaces:**
- Consumes: crate at `plugins/solomd-notes/server` (Task 4); env vars from Global Constraints.

- [ ] **Step 1: Write the failing launcher tests** — `plugins/solomd-notes/test/launcher.test.mjs`

```js
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
```

- [ ] **Step 2: Run — expect FAIL**

Run: `node --test plugins/solomd-notes/test/launcher.test.mjs`
Expected: FAIL (`ENOENT` spawning `bin/solomd-mcp`).

- [ ] **Step 3: Write the launcher** — `plugins/solomd-notes/bin/solomd-mcp`

```sh
#!/bin/sh
set -eu

APP_BIN="Contents/MacOS/solomd-mcp"

find_bin() {
  if [ -n "${SOLOMD_MCP_BIN:-}" ]; then echo "$SOLOMD_MCP_BIN"; return; fi
  for app in /Applications/SoloMD.app "$HOME/Applications/SoloMD.app"; do
    if [ -x "$app/$APP_BIN" ]; then echo "$app/$APP_BIN"; return; fi
  done
  command -v solomd-mcp || true
}

bin=$(find_bin)
if [ -z "$bin" ]; then
  echo "solomd-mcp not found: install SoloMD.app or set SOLOMD_MCP_BIN" >&2
  exit 1
fi
if [ -z "${SOLOMD_WORKSPACE:-}" ]; then
  echo "set SOLOMD_WORKSPACE to your notes folder" >&2
  exit 1
fi
if [ "${SOLOMD_ALLOW_WRITE:-}" = "1" ]; then
  exec "$bin" --workspace "$SOLOMD_WORKSPACE" --allow-write
fi
exec "$bin" --workspace "$SOLOMD_WORKSPACE"
```

Then: `chmod +x plugins/solomd-notes/bin/solomd-mcp`

- [ ] **Step 4: Run — expect PASS** (4 pass, or 3 pass + 1 skipped when SoloMD.app is installed)

Run: `node --test plugins/solomd-notes/test/launcher.test.mjs`

- [ ] **Step 5: Plugin manifests**

`plugins/solomd-notes/.claude-plugin/plugin.json`:

```json
{
  "name": "solomd-notes",
  "version": "0.1.0",
  "description": "Search, read and version a SoloMD Markdown notes folder via solomd-mcp"
}
```

`plugins/solomd-notes/.mcp.json`:

```json
{
  "mcpServers": {
    "solomd": {
      "command": "${CLAUDE_PLUGIN_ROOT}/bin/solomd-mcp"
    }
  }
}
```

- [ ] **Step 6: Move the skill and client docs**

```bash
mkdir -p plugins/solomd-notes/skills/solomd plugins/solomd-notes/docs
git mv marketplace/claude-code-skill/solomd/SKILL.md plugins/solomd-notes/skills/solomd/SKILL.md
git mv marketplace/client-docs plugins/solomd-notes/docs/clients
```

- [ ] **Step 7: Rewrite the skill** — `plugins/solomd-notes/skills/solomd/SKILL.md`

1. Frontmatter: keep `name: solomd`; set `description:` to `Read, search, edit and version-control a folder of Markdown notes through the solomd-mcp server: 14 tools including per-note AutoGit history, backlinks, tags and share links. Use when the user works with their notes vault, asks to summarise, find TODOs, suggest links or restore an old version of a note.`; delete the `allowed-tools` line.
2. Replace the whole `## Setup (one-time)` section with:

```markdown
## Setup

The plugin starts `solomd-mcp` from SoloMD.app (`/Applications` or `~/Applications`), else from `PATH`. Set before starting Claude Code:

| Env var | Meaning |
|---|---|
| `SOLOMD_WORKSPACE` | Notes folder (required) |
| `SOLOMD_ALLOW_WRITE=1` | Enable the 3 write tools (read-only otherwise) |
| `SOLOMD_MCP_BIN` | Explicit path to a `solomd-mcp` binary |
```

3. Tool list: replace every `solomd:` prefix with nothing (tool names are `list_notes`, `read_note`, `search`, `get_backlinks`, `list_tags`, `get_outline`, `autogit_log`, `autogit_diff`, `sync_status`, `share_url`, `read_agent_trace`, `write_note`, `append_to_note`, `autogit_rollback` — 14, matching `plugins/solomd-notes/server/src/tools.rs`). Delete the "Multi-vault" section (the launcher passes one workspace).
4. Replace `## Starter recipes` and `## Recipe catalog` with:

```markdown
## Recipes

SoloMD's 11 reference agent recipes live in [`app/src-tauri/cookbook/`](https://github.com/ofekisr/solomd-rtl/tree/main/app/src-tauri/cookbook). They run inside the SoloMD app. From Claude Code, treat a recipe's `prompt:` block as the user's request and call the tools above.
```

5. In `## About SoloMD`, delete the four upstream download links; keep the first paragraph.

Check: `grep -nE "solomd:|install.sh|recipes/|zhitongblog" plugins/solomd-notes/skills/solomd/SKILL.md` → no output.

- [ ] **Step 8: README** — `plugins/solomd-notes/README.md`

```markdown
# solomd-notes plugin

Claude Code access to a SoloMD Markdown notes folder through `solomd-mcp` (14 tools: search, backlinks, tags, outlines, per-note AutoGit history, share links).

## Install

1. Install SoloMD.app — it bundles `solomd-mcp`. Or put a `solomd-mcp` binary on `PATH`.
2. `/plugin marketplace add ofekisr/solomd-rtl` then `/plugin install solomd-notes@solomd-rtl`.
3. Set `SOLOMD_WORKSPACE` (required), optionally `SOLOMD_ALLOW_WRITE=1` and `SOLOMD_MCP_BIN`, then start `claude`.

## Other MCP clients

Per-client setup: [docs/clients/](docs/clients/) (Claude Desktop, Cursor, Cline, Continue, Zed). Their install commands still name upstream release URLs.

## Layout

| Path | What |
|---|---|
| `bin/solomd-mcp` | Launcher: finds the binary, checks env, starts it |
| `skills/solomd/` | The `solomd` skill |
| `server/` | `solomd-mcp` Rust crate (also bundled into SoloMD.app by `scripts/build-mcp-sidecar.sh`) |

## Test

`node --test plugins/solomd-notes/test/*.test.mjs` · `cargo test --manifest-path plugins/solomd-notes/server/Cargo.toml`
```

- [ ] **Step 9: Gate the launcher in `verify`** — append to the `verify` script in `app/package.json`:
` && node --test \"../plugins/solomd-notes/test/*.test.mjs\"`

- [ ] **Step 10: `plugins/CLAUDE.md`** — add the `solomd-notes/` row (`server/` — Rust `solomd-mcp`; runs the binary from SoloMD.app via `bin/solomd-mcp` | Yes) and its two test commands.

- [ ] **Step 11: Verify and commit**

Run: `pnpm --dir app verify` → exit 0.

```bash
git add -A plugins/solomd-notes plugins/CLAUDE.md marketplace app/package.json
git commit -m "feat(plugins): solomd-notes plugin with app-bundled solomd-mcp launcher

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `solomd-dev` — move and wire project-locally

**Files:**
- Move: `dev-mcp/` → `plugins/solomd-dev/server/`
- Create: `.mcp.json`, `plugins/solomd-dev/README.md` (moved from `server/README.md`)
- Modify: `README*.md` (15 files), `plugins/CLAUDE.md`

- [ ] **Step 1: Move**

```bash
mkdir -p plugins/solomd-dev
git mv dev-mcp plugins/solomd-dev/server
git mv plugins/solomd-dev/server/README.md plugins/solomd-dev/README.md
```

- [ ] **Step 2: Fix README paths**

```bash
perl -pi -e 's{(?<![\w/-])dev-mcp/}{plugins/solomd-dev/server/}g' README*.md
git grep -nE "(^|[^-/])dev-mcp/" -- README*.md plugins/solomd-dev
```
Expected: no output. If `plugins/solomd-dev/README.md` mentions paths like `src/main.rs` or `cargo build` from its old folder, prefix them with `server/`.

- [ ] **Step 3: Wire it for this repo** — root `.mcp.json`

```json
{
  "mcpServers": {
    "solomd-dev": {
      "command": "cargo",
      "args": ["run", "--quiet", "--release", "--manifest-path", "plugins/solomd-dev/server/Cargo.toml", "--"]
    }
  }
}
```

- [ ] **Step 4: Build**

Run: `cargo check --manifest-path plugins/solomd-dev/server/Cargo.toml`
Expected: exit 0.

- [ ] **Step 5: `plugins/CLAUDE.md`** — add row `solomd-dev/` | `server/` — Rust self-test server that drives the running app; wired by root `.mcp.json` | No (contributors only).

- [ ] **Step 6: Verify and commit**

Run: `pnpm --dir app verify` → exit 0.

```bash
git add -A dev-mcp plugins/solomd-dev plugins/CLAUDE.md .mcp.json README*.md
git commit -m "refactor(plugins): move dev-mcp/ into plugins/solomd-dev, wire via .mcp.json

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Marketplace manifest and upstream cleanup

**Files:**
- Create: `.claude-plugin/marketplace.json`
- Delete: `marketplace/` (remainder), `server.json`, `smithery.yaml`
- Modify: `README.md` (MCP client table + marketplace bullets), root `CLAUDE.md` (Layout row for `.claude-plugin/`), `docs/solomd-rtl.mmap` via `mmap_*` tools

- [ ] **Step 1: Manifest** — `.claude-plugin/marketplace.json`

```json
{
  "name": "solomd-rtl",
  "owner": { "name": "ofekisr" },
  "plugins": [
    {
      "name": "solomd-mindmap",
      "source": "./plugins/solomd-mindmap",
      "description": "Read and edit SoloMD .mmap mind maps; bind sessions to nodes"
    },
    {
      "name": "solomd-notes",
      "source": "./plugins/solomd-notes",
      "description": "Search, read and version a SoloMD Markdown notes folder via solomd-mcp"
    }
  ]
}
```

- [ ] **Step 2: Validate**

```bash
claude plugin validate .
claude plugin validate plugins/solomd-mindmap
claude plugin validate plugins/solomd-notes
```
Expected: all pass. If the CLI rejects a field, fix the manifest to the schema the error names and re-run.

- [ ] **Step 3: Delete upstream material**

```bash
git ls-files marketplace server.json smithery.yaml
git rm -r marketplace server.json smithery.yaml
```
Expected first command lists only listing files (`_shared/`, `awesome-mcp/`, `smithery/`, `claude-code-skill/README.md`, `claude-code-skill/solomd/install.sh`, `claude-code-skill/solomd/recipes/*.yml`, `README.md`) — the skill and client docs were moved in Task 5.

- [ ] **Step 4: Root `README.md`**

- MCP client table (`README.md:166-171`): link targets `marketplace/client-docs/<x>.md` → `plugins/solomd-notes/docs/clients/<x>.md`.
- Replace the bullets at `README.md:176-180` (Claude Code Skill, Smithery, Awesome MCP, "Full overview") with one bullet: `- **Claude Code plugins** — `/plugin marketplace add ofekisr/solomd-rtl`, then install `solomd-mindmap` and/or `solomd-notes`. See [plugins/](plugins/CLAUDE.md).`

- [ ] **Step 5: Root `CLAUDE.md`** — add Layout row: `` | `.claude-plugin/` | `marketplace.json` — lists the plugins in `plugins/` | ``; extend the `plugins/` row with "root `.mcp.json` wires `solomd-dev`".

- [ ] **Step 6: Leftover scan**

```bash
git grep -nE "(^|[^-/])(mcp-mindmap|mcp-server|dev-mcp|marketplace)/|(^|[^-\w])plugin/(hooks|skills|\.mcp)" -- ':!docs/superpowers' ':!CHANGELOG.md' ':!web' ':!scripts/install-mcp.sh'
```
Expected: no output. Fix each hit.

- [ ] **Step 7: Update the repo map** — in `docs/solomd-rtl.mmap`, using the `mmap_*` tools (never edit the JSON): remove nodes `mcp-mindmap`, `mcp-server`, `dev-mcp`, `plugin`, `marketplace` (confirm with the user first — they have description children); add `plugins` under the root with description child `Claude Code plugins and their MCP servers` and children `solomd-mindmap`, `solomd-notes`, `solomd-dev`, each with a one-line description child.

- [ ] **Step 8: Verify and commit**

Run: `pnpm --dir app verify` → exit 0.

```bash
git add -A .claude-plugin marketplace server.json smithery.yaml README.md CLAUDE.md docs/solomd-rtl.mmap
git commit -m "feat(plugins): marketplace manifest; drop upstream MCP listings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Cut-over and fresh-install check (needs the user)

**Files:** none in the repo; `~/.claude/settings.json` only with explicit OK.

- [ ] **Step 1: Ask the user** — quote the hook entry (`node /Users/ofeki/repos/solomd-rtl/plugin/hooks/session-id.mjs`, `~/.claude/settings.json:248`) and ask to remove it. Do nothing until they answer yes. On yes, remove only that hook entry, keeping valid JSON: `node -e "JSON.parse(require('fs').readFileSync(process.env.HOME+'/.claude/settings.json','utf8'))"` exits 0.

- [ ] **Step 2: Install from the local marketplace** (user runs these in an interactive `claude` session)

```
/plugin marketplace add /Users/ofeki/repos/solomd-rtl
/plugin install solomd-mindmap@solomd-rtl
/plugin install solomd-notes@solomd-rtl
```

- [ ] **Step 3: Fresh session checks**

| Check | Pass |
|---|---|
| Session start | `claude-session-id: …` appears (hook from the installed plugin) |
| `mmap_outline` on `docs/solomd-rtl.mmap`, depth 1 | Returns the root with a `plugins` node |
| `solomd` server, no `SOLOMD_WORKSPACE` | `/mcp` shows it failed; stderr says `set SOLOMD_WORKSPACE to your notes folder` |
| `SOLOMD_WORKSPACE=<notes dir> claude`, call `list_notes` | Returns notes (needs SoloMD.app installed) |

- [ ] **Step 4: Report** results per row; nothing to commit.

---

## Self-review

| Spec section | Task |
|---|---|
| §2 D1–D7, ADR | 1 |
| §3 layout — mindmap | 2, 3 |
| §3 layout — notes, §5 launcher | 4, 5 |
| §3 layout — dev, D6 | 6 |
| §4 manifest, deletions, D4, D5 | 5 (skill/recipes), 7 |
| §6 bundle | 3 |
| §7 gates and paths | 2 (verify, arch), 3 (check), 4 (CI, scripts, Rust, READMEs), 5 (launcher test), 6 (READMEs), 7 (README, CLAUDE.md) |
| §8 cut-over | 8 |
| §9 testing | 2–7 verify runs; 3 freshness; 7 validate + leftovers; 8 install |
| §10 commits | 7 commits (spec's 5, split finer: bundle and notes plugin are separate) |
