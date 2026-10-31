# solomd-rtl

Fork of SoloMD (Vue + CodeMirror + Tauri Markdown editor) with Hebrew/Arabic RTL and `.mmap` mind maps.

## Invariants

These hold in every wave. Break one only through a new ADR.

1. **Spec wins.** If code disagrees with an accepted spec or ADR, fix the code or write a superseding ADR. Accepted ADRs in [docs/adr/](docs/adr/README.md) are settled.
2. **Ratchets only shrink.** Arch baselines ([app/arch/baseline.json](app/arch/baseline.json)) may lose entries or lower values, never gain or raise (renaming a key when its file moves is not a gain).
3. **IPC through ports.** From the end of Wave 1, only `app/src/platform/` imports `@tauri-apps/*`. Until then, add no new `@tauri-apps/*` imports outside it.
4. **`lib/` stays pure.** New code in `app/src/lib/` imports no `vue`, `pinia` or `@tauri-apps/*`. Some existing files still do; they are listed in `app/arch/baseline.json` and may only shrink. Never add such an import to `lib/`.
5. **Features are private.** Import another feature only through its `contracts/`.
6. **Doc sync.** If a code change makes the nearest `CLAUDE.md` wrong or incomplete, fix it in the same commit.
7. **File roles.** New and moved files follow [file roles](docs/conventions/file-roles.md).

## Greenness ladder

The exit code is the only signal. Never commit on red.

| Run | Covers | When |
|---|---|---|
| `pnpm --dir app guard` | arch specs → unit tests → `vue-tsc` (~12s) | After every edit |
| `pnpm --dir app verify` | guard → baseline tight → `vite build` → `cargo check` → plugin tests (~1 min) | Before each commit |
| `pnpm --dir app full` | verify → `cargo test` → Playwright e2e (macOS only) | Before a wave's Integrate gate |

CI (`.github/workflows/ci.yml`) runs guard, the tight check and `vite build` on every PR and push to `main`.

## Layout

| Dir | What |
| --- | --- |
| `app/` | The editor (Vue/Vite web build + `src-tauri/` desktop shell) — see [app/CLAUDE.md](app/CLAUDE.md) |
| `docs/adr/` | Architecture decisions. Accepted = settled — see [README](docs/adr/README.md) |
| `docs/conventions/` | Naming rules — see [file roles](docs/conventions/file-roles.md) |
| `demos/` | Playwright story-driven demo videos — see `demos/CLAUDE.md` |
| `app/src/lib/theme/` | Unified theme layer (v4.39): Zod schema, resolve → `<style id="solomd-theme">`, builtin/catalog JSON, migration. Store: `app/src/stores/theme.ts`. Spec: `docs/superpowers/specs/2026-10-29-theme-layer-design.md` |
| `plugins/` | Claude Code plugins + their MCP servers; `solomd-dev` is opt-in (see its README) — see [plugins/CLAUDE.md](plugins/CLAUDE.md) |
| `.claude-plugin/` | `marketplace.json` — lists the plugins in `plugins/` |
| `.claude/launch.json` | Dev servers: `solomd-web` (1420), `solomd-web-alt` (1430) |

## Commands

```bash
pnpm --dir app install
pnpm --dir app dev      # web build on :1420
pnpm --dir app build    # vue-tsc + vite build
pnpm --dir app test     # node --test
pnpm --dir app guard    # after every edit (see Greenness ladder)
pnpm --dir app verify   # before each commit
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
