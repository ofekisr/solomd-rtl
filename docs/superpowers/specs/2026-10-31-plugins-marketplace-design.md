## Spec: `plugins/` folder and a Claude Code marketplace for solomd-rtl

**Status**: Draft | **Version**: v1.0 | **Date**: 31-10-26

---

### 1. Overview

**Problem**: Five root folders do one job — expose SoloMD to agents — with no visible relation between them:

| Folder | Today |
|---|---|
| `mcp-server/` | `solomd-mcp`, Rust notes server; bundled in SoloMD.app as a sidecar |
| `mcp-mindmap/` | `.mmap` MCP server, TS; imports `app/src/lib/mindmap/` |
| `plugin/` | Claude Code plugin: `mindmap` skill + hooks; `.mcp.json` runs `../mcp-mindmap` |
| `dev-mcp/` | Rust self-test server that drives the running app |
| `marketplace/` | Upstream's MCP-directory listings + a `solomd` skill for `solomd-mcp` |

Three defects follow:

- `plugin/` breaks when installed from a marketplace: install copies only the plugin folder, and both `../mcp-mindmap` and its `app/src/lib` imports sit outside it.
- The mindmap hooks work only through a hard-coded path in the user's global `~/.claude/settings.json`.
- `marketplace/`, `server.json` and `smithery.yaml` advertise upstream (`zhitongblog/solomd`, 62 references) and the fork publishes no releases, so its `install.sh` cannot work for this repo.

**Solution**: One `plugins/` folder. Each plugin owns its skill, hooks and server source. A root `.claude-plugin/marketplace.json` makes the repo installable with `/plugin marketplace add ofekisr/solomd-rtl`. Upstream listing material is deleted.

**Scope**
- In: `plugin/`, `mcp-mindmap/`, `mcp-server/`, `dev-mcp/`, `marketplace/`, root `server.json` and `smithery.yaml`, every path that references them.
- Out: new MCP tools, recipe-to-skill conversion, fork release pipeline, `.agents/skills` (`competitor-feedback`, `store-submit` stay as they are), Option C root regrouping of non-code folders.

### 2. Decisions

| # | Decision | Rejected |
|---|---|---|
| D1 | Folder name `plugins/` (Claude Code's own term) | `ai-integration/` (vague), `ai/` (clashes with planned `app/src/ai/`), moving into `app/` (pollutes the Tauri/Vite build) |
| D2 | Each plugin holds its server source under `server/` | Crates stay at root — keeps the five-folder sprawl |
| D3 | `solomd-notes` runs the `solomd-mcp` bundled in SoloMD.app, falling back to `PATH` | Build from source (needs Rust), fork releases (new pipeline) |
| D4 | Delete upstream listings; keep `client-docs/` as the `solomd-notes` README | Archive (stale links), rebrand (needs fork releases) |
| D5 | Drop the recipe copy; the skill links to `app/src-tauri/cookbook/` | Build-time copy (no value: recipes run in the app), convert to skills (separate feature) |
| D6 | `solomd-dev` lives in `plugins/` but is not listed in `marketplace.json`; wired by the repo's `.mcp.json` | Publishing it (evals arbitrary JS in the user's app) |
| D7 | Mindmap server ships as a committed esbuild bundle; `verify` fails when it is stale | Point at a repo checkout (no marketplace use), npm package (publishing) |

### 3. Target layout

```
.claude-plugin/
  marketplace.json                 lists solomd-mindmap, solomd-notes
.mcp.json                          project scope: solomd-dev
plugins/
  CLAUDE.md                        what each plugin is, how to build and test
  solomd-mindmap/                  ← plugin/ + mcp-mindmap/
    .claude-plugin/plugin.json
    .mcp.json                      node ${CLAUDE_PLUGIN_ROOT}/server/dist/index.mjs --allow-write
    skills/mindmap/SKILL.md
    hooks/  hooks.json  session-id.mjs  ai-lock.mjs  *.test.mjs
    server/
      package.json  tsconfig.json  build.mjs
      src/  test/                  imports ../../../../app/src/lib/mindmap/
      dist/index.mjs               generated, committed
  solomd-notes/                    ← marketplace/claude-code-skill/solomd/ + mcp-server/
    .claude-plugin/plugin.json
    .mcp.json                      ${CLAUDE_PLUGIN_ROOT}/bin/solomd-mcp
    bin/solomd-mcp                 launcher (§5)
    skills/solomd/SKILL.md
    README.md                      merged marketplace/client-docs/*
    server/                        Rust crate (was mcp-server/, incl. mcpb/)
  solomd-dev/                      ← dev-mcp/
    README.md
    server/                        Rust crate (was dev-mcp/)
```

Deleted: `marketplace/` (minus the parts moved above), `server.json`, `smithery.yaml`, `marketplace/claude-code-skill/solomd/install.sh`, `marketplace/claude-code-skill/solomd/recipes/`.

### 4. Marketplace manifest

```json
{
  "name": "solomd-rtl",
  "owner": { "name": "Ofek" },
  "plugins": [
    { "name": "solomd-mindmap", "source": "./plugins/solomd-mindmap",
      "description": "Read and edit SoloMD .mmap mind maps; bind sessions to nodes" },
    { "name": "solomd-notes", "source": "./plugins/solomd-notes",
      "description": "Search, read and version a SoloMD Markdown notes folder via solomd-mcp" }
  ]
}
```

Plugin manifests start at `0.1.0` (`solomd-mindmap` keeps its current `0.1.0`).

### 5. `solomd-notes` launcher

`bin/solomd-mcp` (POSIX sh, executable):

1. Resolve the binary, first hit wins: `$SOLOMD_MCP_BIN` → `/Applications/SoloMD.app/Contents/MacOS/solomd-mcp` → `$HOME/Applications/SoloMD.app/Contents/MacOS/solomd-mcp` → `command -v solomd-mcp`.
2. No binary → print to stderr "solomd-mcp not found: install SoloMD.app or set SOLOMD_MCP_BIN" and exit 1.
3. `$SOLOMD_WORKSPACE` unset → print "set SOLOMD_WORKSPACE to your notes folder" and exit 1.
4. `exec "$bin" --workspace "$SOLOMD_WORKSPACE"`, adding `--allow-write` only when `SOLOMD_ALLOW_WRITE=1`.

The skill drops its Setup/`install.sh` section, documents the three env vars, drops `allowed-tools`, and its tool list is checked against `server/src` (the listing copy claims 13 tools but lists 14).

### 6. Mindmap bundle

- `server/build.mjs` runs esbuild (resolved from `app/node_modules`): entry `src/index.ts`, `platform: node`, `format: esm`, `bundle: true`, shebang banner, output `dist/index.mjs`.
- `pnpm --dir plugins/solomd-mindmap/server build` writes the bundle; `check` builds to a temp file and exits 1 if it differs from `dist/index.mjs`.
- The hook tests (`hooks/*.test.mjs`) run in the server's `test` script — no check runs them today.

### 7. Gates and path updates

| Item | Change |
|---|---|
| `app/package.json` `verify` | `pnpm --dir ../mcp-mindmap test` → `pnpm --dir ../plugins/solomd-mindmap/server test && … check` |
| `app/arch/file-size.rule.ts` (+ test) | root `mcp-mindmap/src` → `plugins/solomd-mindmap/server/src` |
| `.github/workflows/release.yml` | `mcp-server/target` → `plugins/solomd-notes/server/target` (4 sites) |
| `scripts/` | `build-mcp-sidecar.sh`, `build-mcpb.sh`, `install-mcp.sh`, `publish-mcp-crate.sh`, `ubuntu-build.sh`, `v4-self-test.sh` |
| Rust doc comments | `app/src-tauri/src/{agent_tools,commands/file_io,trace}.rs`, `app/src/lib/wikilinks.ts` |
| Docs | 15 `README*.md` (MCP section; `README.md` client table → `plugins/solomd-notes/README.md`), `docs/agents.md`, root `CLAUDE.md` Layout + Greenness rows, `app/arch/CLAUDE.md` |
| Historical docs | `docs/superpowers/{specs,plans}`, `CHANGELOG.md`, `web/` — unchanged |
| ADR | `docs/adr/0008-plugins-folder.md` records D1–D7 |

Invariant 2 holds: `baseline.json` has no keys under the moved folders.

### 8. Cut-over

1. User's global `~/.claude/settings.json` hook `node …/plugin/hooks/session-id.mjs` is removed — **only with the user's explicit OK**; the installed plugin supplies the hook instead.
2. `/plugin marketplace add /Users/ofeki/repos/solomd-rtl`, then install `solomd-mindmap` and `solomd-notes`.

### 9. Testing

| Check | Pass when |
|---|---|
| `pnpm --dir app verify` | exit 0; unit 1760, arch 48, mindmap server 45 + hook tests |
| Bundle freshness | `check` exits 0 on a clean tree and 1 after editing any `server/src` file without rebuilding |
| `claude plugin validate` | passes for both plugins and the marketplace |
| Fresh install | new session after §8: `mmap_outline` on `docs/solomd-rtl.mmap` answers; `session-id` hook prints the id |
| Launcher | missing binary and missing workspace each print their message and exit 1; with SoloMD.app installed, `solomd` `list_notes` answers |
| `cargo check` | both crates build from their new paths |
| Leftovers | `git grep -nE "(^|[^-/])(mcp-mindmap|mcp-server|dev-mcp|marketplace)/"` outside historical docs returns nothing |

### 10. Commits

1. ADR 0008 + this spec.
2. `solomd-mindmap`: move `plugin/` + `mcp-mindmap/`, bundle, gates.
3. `solomd-notes`: move `mcp-server/` + skill, launcher, README, script and CI paths.
4. `solomd-dev`: move `dev-mcp/`, root `.mcp.json`.
5. Marketplace manifest; delete `marketplace/`, `server.json`, `smithery.yaml`; README and CLAUDE.md sync.

Each commit passes `pnpm --dir app verify`.
