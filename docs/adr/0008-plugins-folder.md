# 0008. One `plugins/` folder and a Claude Code marketplace

**Status**: accepted · **Date**: 2026-10-31

## Context

- Five root folders exposed SoloMD to agents with no visible relation: `mcp-server/`, `mcp-mindmap/`, `plugin/`, `dev-mcp/`, `marketplace/`.
- `plugin/` broke when installed from a marketplace: its `.mcp.json` and server imports reached outside the plugin folder.
- `marketplace/`, `server.json` and `smithery.yaml` advertised upstream; the fork publishes no releases.
- Full design: [spec](../superpowers/specs/2026-10-31-plugins-marketplace-design.md).

## Decision

1. All agent integrations live in `plugins/<name>/`; each plugin owns its skill, hooks and server source under `server/`.
2. `.claude-plugin/marketplace.json` at the root lists `solomd-mindmap` and `solomd-notes`.
3. `solomd-notes` runs the `solomd-mcp` bundled in SoloMD.app, falling back to `PATH`.
4. The mindmap server ships as a committed esbuild bundle; `verify` fails when it is stale.
5. `solomd-dev` is not listed in the marketplace and not auto-wired; contributors opt in with `claude mcp add --scope local` (it can eval JS in the app and write any file).
6. Upstream MCP-directory listings are deleted; the recipe copy is dropped in favour of `app/src-tauri/cookbook/`.

## Consequences

- Easier: one place for agent integrations; `/plugin marketplace add ofekisr/solomd-rtl` installs them.
- Harder: a generated file (`dist/index.mjs`) is committed and must be rebuilt after server changes.
- Must: run `pnpm --dir plugins/solomd-mindmap/server build` after editing the mindmap server or `app/src/lib/mindmap/`.
