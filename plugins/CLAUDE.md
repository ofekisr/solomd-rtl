# plugins/

Claude Code plugins this repo exposes. Each plugin owns its skill, hooks and server source.

| Plugin | Server | Listed in marketplace |
|---|---|---|
| `solomd-mindmap/` | `server/` — TS, imports `app/src/lib/mindmap/` | Yes |

## Rules

- A plugin reads nothing outside its own folder at runtime: marketplace installs copy only the plugin folder.
- After editing `server/src` or `app/src/lib/mindmap/`, run `pnpm --dir plugins/solomd-mindmap/server build`; the committed `server/dist/index.mjs` is what installs run.
- `server/src` `.ts` files ≤ 400 lines (`app/arch` file-size rule).

## Test

| Run | Covers |
|---|---|
| `pnpm --dir plugins/solomd-mindmap/server test` | server unit tests + hook tests + bundle smoke test |
| `pnpm --dir plugins/solomd-mindmap/server build` | regenerate `dist/index.mjs` |
| `pnpm --dir plugins/solomd-mindmap/server check` | exit 1 if the bundle is stale (gated in `verify`) |
