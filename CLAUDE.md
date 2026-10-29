# solomd-rtl

Fork of SoloMD (Vue + CodeMirror + Tauri Markdown editor) with Hebrew/Arabic RTL and `.mmap` mind maps.

## Layout

| Dir | What |
| --- | --- |
| `app/` | The editor (Vue/Vite web build + `src-tauri/` desktop shell) |
| `demos/` | Playwright story-driven demo videos — see `demos/CLAUDE.md` |
| `app/src/lib/theme/` | Unified theme layer (v4.39): Zod schema, resolve → `<style id="solomd-theme">`, builtin/catalog JSON, migration. Store: `app/src/stores/theme.ts`. Spec: `docs/superpowers/specs/2026-10-29-theme-layer-design.md` |
| `mcp-mindmap/` | Stdio MCP server for `.mmap` (TS, imports `app/src/lib`) — `pnpm --dir mcp-mindmap test` |
| `plugin/` | Claude Code plugin: mindmap MCP + skill + session-id hook |
| `.claude/launch.json` | Dev servers: `solomd-web` (1420), `solomd-web-alt` (1430) |

## Commands

```bash
pnpm --dir app install
pnpm --dir app dev      # web build on :1420
pnpm --dir app build    # vue-tsc + vite build
pnpm --dir app test     # node --test
pnpm --dir app theme:catalog   # regenerate lib/theme/catalog/*.json (Playwright extraction)
pnpm --dir app exec playwright test --config e2e/playwright.config.ts   # theme e2e, port 1440; macOS-only baselines
```

## Demo videos (quick reproduce)

```bash
pnpm --dir demos install
pnpm --dir demos exec playwright install chromium
pnpm --dir demos demo highlights   # short reel → demos/out/highlights.mp4 + .gif
pnpm --dir demos demo all          # 8 stories → demos/out/solomd-rtl-demo.mp4
```

Needs `ffmpeg` and `app/` deps installed. Details, env vars and gotchas: `demos/CLAUDE.md`.
