# solomd-notes plugin

Claude Code access to a SoloMD Markdown notes folder through `solomd-mcp` (16 tools: search, backlinks, tags, outlines, per-note AutoGit history, share links).

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
