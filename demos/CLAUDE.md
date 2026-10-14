# demos/ — story-driven demo videos

Playwright records each `stories/*.story.ts` against the **web build** of `app/` (Tauri backend mocked), then `record.mjs` trims the boot and encodes with ffmpeg. Human docs + story table: `README.md`.

## Reproduce from scratch

```bash
brew install ffmpeg                                # once
pnpm --dir app install                             # webServer runs app's vite
pnpm --dir demos install
pnpm --dir demos exec playwright install chromium
pnpm --dir demos demo all --dry-run                # sanity: lists stories, records nothing
pnpm --dir demos demo all
```

| Command | Output (`demos/out/`, gitignored) |
| --- | --- |
| `pnpm --dir demos demo 03` | `03-mindmap-new.mp4` (prefix match) |
| `pnpm --dir demos demo all` | every `NN-*` story + joined `solomd-rtl-demo.mp4` |
| `pnpm --dir demos demo highlights` | `highlights.mp4` + `highlights.gif` (only gif story) |
| `pnpm --dir demos typecheck` | `tsc --noEmit` over kit + stories |

## Env vars

| Var | Default | Effect |
| --- | --- | --- |
| `DEMO_SPEED` | `1.5` | Playback speed, applied at ffmpeg encode |
| `DEMO_TEMPO` | `1` | Pacing while recording; lower = faster run |
| `DEMO_SHOTS` | off | `1` → one PNG per step in `out/shots/<story>/` |
| `DEMO_PORT` | `1440` | Port for the vite server Playwright starts |

Fast review loop without watching video:

```bash
DEMO_SHOTS=1 DEMO_TEMPO=0.3 pnpm --dir demos exec playwright test stories/03-mindmap-new.story.ts
```

## Pipeline

1. `playwright.config.ts` starts `vite` from `../app` on `:1440` (`--strictPort`, never reuses), 1280×720, video on, 1 worker.
2. `kit/fixtures.ts` → `demo` fixture: injects overlay, seeds `localStorage` (`kit/seed.ts`), writes `out/timing/<story>.json` (boot trim offset).
3. `kit/tauri-mock.ts` fakes the desktop backend; serves `content/vault/` as `/Users/demo/פרויקט`.
4. `kit/director.ts`: `title → step(caption, action) → end`; `kit/cursor.ts` moves the real + drawn cursor; every action gets an on-screen badge.
5. `record.mjs`: runs story → finds `out/raw/<story>-*/video.webm` → trims → H.264 mp4 (+ gif for `highlights`) → concat for `all`.

## Gotchas

- Port **1440** must be free; the dev server on 1420 is untouched.
- A failed story writes **no** video. Debug with `pnpm --dir demos exec playwright show-trace out/raw/<story>-*/trace.zip`.
- Headless Chromium ignores OS paste → use `c.paste(text, selector)`.
- Keep click targets inside 1280×720; long context menus can run off-frame.
- New story: `stories/NN-name.story.ts` (numbered = included in `all`), sample files in `content/` (Hebrew first). Template in `README.md`.
- App changes need no demo-side rebuild — vite serves `app/` source live per run.
