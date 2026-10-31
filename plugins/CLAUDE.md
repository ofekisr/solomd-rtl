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
