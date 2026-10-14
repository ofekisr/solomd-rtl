# solomd-rtl

Fork of SoloMD (Vue + CodeMirror + Tauri Markdown editor) with Hebrew/Arabic RTL and `.mmap` mind maps.

## Layout

| Dir | What |
| --- | --- |
| `app/` | The editor (Vue/Vite web build + `src-tauri/` desktop shell) |
| `demos/` | Playwright story-driven demo videos — see `demos/CLAUDE.md` |
| `.claude/launch.json` | Dev servers: `solomd-web` (1420), `solomd-web-alt` (1430) |

## Commands

```bash
pnpm --dir app install
pnpm --dir app dev      # web build on :1420
pnpm --dir app build    # vue-tsc + vite build
```

## Demo videos (quick reproduce)

```bash
pnpm --dir demos install
pnpm --dir demos exec playwright install chromium
pnpm --dir demos demo highlights   # short reel → demos/out/highlights.mp4 + .gif
pnpm --dir demos demo all          # 8 stories → demos/out/solomd-rtl-demo.mp4
```

Needs `ffmpeg` and `app/` deps installed. Details, env vars and gotchas: `demos/CLAUDE.md`.
